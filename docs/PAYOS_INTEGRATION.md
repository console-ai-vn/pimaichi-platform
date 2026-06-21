# Tích hợp PayOS

> **PayOS** — Cổng thanh toán thuộc hệ sinh thái Casso, chuyên xử lý payment link, VietQR, và webhook cho merchant Việt Nam.
> Worker hiện tại dùng **custom Web Crypto HMAC** thay vì SDK `@payos/node` (vì SDK dùng `crypto.createHmac()` của Node gây lỗi `Illegal invocation` trong Cloudflare Workers).

---

## Mục lục

1. [Kiến trúc](#1-kiến-trúc)
2. [API Endpoints](#2-api-endpoints)
3. [Luồng thanh toán](#3-luồng-thanh-toán)
4. [Secrets & Cấu hình](#4-secrets--cấu-hình)
5. [Triển khai lần đầu](#5-triển-khai-lần-đầu)
6. [So sánh: PayOS vs SePay](#6-so-sánh-payos-vs-sepay)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Kiến trúc

```
┌──────────────────────┐      POST /api/v1/payments/checkout
│   React Router App   │ ────────────────────────────────────┐
│   (frontend SPA)     │                                     ▼
└──────────────────────┘                           ┌─────────────────────┐
                                                   │  Hono Worker        │
                                                   │  workers/routes/    │
                                                   │  payment.ts         │
                                                   └─────┬───────────────┘
                                                         │
                                      ┌──────────────────┼──────────────────┐
                                      ▼                  ▼                  ▼
                              ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
                              │  PayOS API   │  │  PaymentDO   │  │  Global          │
                              │  (external)  │  │  (per-mailbox)│  │  PaymentDO       │
                              │  /v2/payment-│  │  SQLite DO   │  │  (payment_link   │
                              │  requests    │  │  subscriptions│  │  map)            │
                              └──────┬───────┘  │  invoices    │  └──────────────────┘
                                     │          │  payment_logs│
                                     ▼          └──────────────┘
                              ┌──────────────────┐
                              │  PayOS Webhook   │
                              │  POST .../webhook│
                              └──────────────────┘
```

### Worker files liên quan

| File | Vai trò |
|------|---------|
| `workers/routes/payment.ts` | Route handlers: checkout, webhook, subscription, invoices, cancel |
| `workers/lib/payos.ts` | Custom PayOS client (Web Crypto HMAC) thay thế `@payos/node` SDK |
| `workers/lib/payment-stub.ts` | Helper lấy DurableObjectStub cho PaymentDO |
| `workers/durableObject/payment.ts` | PaymentDO: subscription/invoice state machine + alarm renew |
| `workers/durableObject/paymentMigrations.ts` | SQL migration tables (`subscriptions`, `invoices`, `payment_logs`, `payment_link_map`) |
| `workers/index.ts` | Mount paymentApp tại `/api/v1/payments` |
| `scripts/test-payos.mjs` | Test trực tiếp PayOS API (chạy local, dùng SDK) |
| `scripts/setup-payos-webhook.mjs` | Confirm webhook URL với PayOS API |

---

## 2. API Endpoints

Tất cả đều mount tại `/api/v1/payments` (xem `workers/index.ts`).

### `POST /api/v1/payments/checkout`

Tạo payment link, subscription, và invoice.

**Request body:**
```json
{
  "mailboxId": "user@example.com",
  "tier": "basic"
}
```

**Response 201:**
```json
{
  "subscription": { "id": "...", "status": "pending", ... },
  "invoice": { "id": "...", "amount": 190000, "qrCode": "https://img.vietqr.io/...", ... },
  "checkoutUrl": "https://pay.payos.vn/web/...",
  "qrCode": "https://img.vietqr.io/...",
  "qrRaw": "000201010212...",
  "amount": 190000,
  "tier": "basic",
  "bin": "970422",
  "accountNumber": "VQRQAJWQW9122",
  "accountName": "NGUYEN THAI HIEU"
}
```

### `POST /api/v1/payments/webhook`

Nhận webhook từ PayOS khi thanh toán thành công.

**Request (từ PayOS):**
```json
{
  "data": {
    "orderCode": 123456,
    "amount": 190000,
    "description": "basic",
    "paymentLinkId": "abc123",
    "reference": "txn_ref",
    "transactionDateTime": "2026-06-21T11:25:00",
    "code": "00",
    "desc": "success"
  },
  "signature": "hmac_sha256_hex..."
}
```

**Response 200:**
```json
{ "status": "activated", "transactionDateTime": "2026-06-21T11:25:00" }
```

### `GET /api/v1/payments/subscription/:mailboxId`

Xem subscription hiện tại.

### `POST /api/v1/payments/subscription/:mailboxId/cancel`

Huỷ subscription (chỉ khi status `active` hoặc `past_due`).

### `GET /api/v1/payments/invoices/:mailboxId`

Danh sách invoices.

### `GET /api/v1/payments/invoice/:id`

Chi tiết invoice (cần `?mailboxId=`).

---

## 3. Luồng thanh toán

```
[User] Click "Subscribe"
   │
   ▼
POST /api/v1/payments/checkout { mailboxId, tier }
   │
   ├── 1. Validate body (mailboxId: email, tier: basic|pro|premium)
   ├── 2. Kiểm tra subscription hiện tại → 409 nếu đang active
   ├── 3. Tạo orderCode (timestamp % 1e9 + random)
   ├── 4. build HMAC-SHA256 signature
   │      dataStr = amount=...&cancelUrl=...&description=...&orderCode=...&returnUrl=...
   │      sign = hmacSha256(checksumKey, dataStr)
   ├── 5. POST https://api-merchant.payos.vn/v2/payment-requests
   │      Headers: x-client-id, x-api-key
   │      Body: { orderCode, amount, description, cancelUrl, returnUrl, signature }
   ├── 6. Verify response signature (HMAC trên response data)
   ├── 7. Tạo subscription (per-mailbox PaymentDO, status=pending)
   ├── 8. Tạo invoice (status=pending)
   ├── 9. Store paymentLinkId → mailboxId mapping (global PaymentDO)
   └── 10. Return { subscription, invoice, checkoutUrl, qrCode, ... }

[User] Thanh toán tại pay.payos.vn hoặc quét QR
   │
   ▼
PayOS gửi webhook → POST /api/v1/payments/webhook
   │
   ├── 1. Verify HMAC-SHA256 signature của webhook data
   ├── 2. Kiểm tra data.code === "00" (success)
   ├── 3. Idempotency check (payment_logs theo idempotency_key)
   ├── 4. Lookup mailboxId từ paymentLinkId (global PaymentDO)
   ├── 5. Tìm pending invoice với providerTxnId === paymentLinkId
   ├── 6. Verify amount >= invoice.amount
   ├── 7. activateSubscription() → status='active'
   ├── 8. settleInvoice() → status='paid'
   └── 9. Return { status: "activated" }

[Alarm] PaymentDO alarm (mỗi 6h)
   ├── Kiểm tra subscription sắp hết hạn (3 ngày)
   │   └── Tạo invoice mới cho renewal
   └── Kiểm tra subscription quá hạn
       └── Chuyển status → 'past_due'
```

### Tiers & Pricing

| Tier   | Giá (VND) |
|--------|-----------|
| basic  | 190,000   |
| pro    | 490,000   |
| premium| 990,000   |

### Lưu ý description

PayOS giới hạn description tối đa **25 ký tự** (theo quy định NHNN cho VietQR).
Hiện tại chỉ gửi tên tier (vd: `"basic"`, `"pro"`), KHÔNG gửi `"PIMAICHI basic subscription"`.

---

## 4. Secrets & Cấu hình

### Worker secrets (`wrangler secret put`)

| Secret | Mô tả | Lấy từ đâu |
|--------|-------|------------|
| `PAYOS_CLIENT_ID` | Client ID của payment channel | PayOS dashboard → Settings → API Keys |
| `PAYOS_API_KEY`   | API key | PayOS dashboard → Settings → API Keys |
| `PAYOS_CHECKSUM_KEY` | Checksum key (dùng HMAC signing) | PayOS dashboard → Settings → API Keys |
| `DEMO_MODE` | `"true"` để bypass Access auth | Set manually |

### Env vars (wrangler.jsonc vars)

| Var | Mô tả |
|-----|-------|
| `DOMAINS` | `pimaichi.local` (placeholder) |
| `EMAIL_ADDRESSES` | Danh sách mailbox được phép |

### Webhook URL

```
https://pimaichi-platform.ceo-23f.workers.dev/api/v1/payments/webhook
```

Cấu hình tại PayOS dashboard → **Settings → Webhook**.

---

## 5. Triển khai lần đầu

### 5.1 Kích hoạt merchant

1. Đăng ký tại https://payos.vn
2. Hoàn tất xác minh merchant (CMND/CCCD, giấy phép kinh doanh)
3. Vào **Dashboard → Payment Gateway** → **Activate**
4. Nếu chưa active, API trả về `code: 214` — "payment gateway is not active"

### 5.2 Tạo Payment Channel

Trong PayOS dashboard:
1. Vào **Settings → Payment Channels**
2. Tạo channel mới
3. Copy `Client ID`, `API Key`, `Checksum Key`
4. Set secrets:
```bash
wrangler secret put PAYOS_CLIENT_ID
wrangler secret put PAYOS_API_KEY
wrangler secret put PAYOS_CHECKSUM_KEY
```

### 5.3 Cấu hình Webhook

**Cách 1 — Manual (recommended nếu gateway chưa active):**
1. Vào PayOS dashboard → **Settings → Webhook**
2. Nhập: `https://pimaichi-platform.ceo-23f.workers.dev/api/v1/payments/webhook`

**Cách 2 — Tự động (cần gateway active):**
```bash
PAYOS_CLIENT_ID=xxx PAYOS_API_KEY=xxx PAYOS_CHECKSUM_KEY=xxx node scripts/setup-payos-webhook.mjs
```

### 5.4 Test

```bash
# Test trực tiếp PayOS API (local Node.js)
PAYOS_CLIENT_ID=xxx PAYOS_API_KEY=xxx PAYOS_CHECKSUM_KEY=xxx node scripts/test-payos.mjs

# Test qua worker
curl -X POST https://pimaichi-platform.ceo-23f.workers.dev/api/v1/payments/checkout \
  -H "Content-Type: application/json" \
  -d '{"mailboxId":"user@example.com","tier":"basic"}'

# Kiểm tra subscription
curl https://pimaichi-platform.ceo-23f.workers.dev/api/v1/payments/subscription/user@example.com
```

### 5.5 Deploy

```bash
pnpm build && npx wrangler deploy
```

---

## 6. So sánh: PayOS vs SePay

| Tiêu chí | PayOS | SePay |
|----------|-------|-------|
| Payment Link | ✅ Có (checkout page) | ❌ Chỉ QR |
| QR Code | ✅ VietQR + QR raw | ✅ VietQR |
| Webhook | ✅ HMAC SHA-256 | ✅ HMAC SHA-256 |
| SDK cho Workers | ❌ (cần custom Web Crypto) | ❌ (cần custom fetch) |
| Max description | 25 ký tự | Không giới hạn |
| Merchant activation | ✅ (cần duyệt) | ✅ (dễ hơn) |
| API base URL | `https://api-merchant.payos.vn` | `https://my.sepay.vn` |
| Error code 214 | Gateway chưa active | N/A |

**Lý do chuyển từ SePay → PayOS:**
- PayOS có Payment Link (checkout page) — UX tốt hơn QR đơn thuần
- PayOS thuộc hệ sinh thái Casso, hỗ trợ nhiều ngân hàng hơn
- Cả hai đều dùng VietQR nên QR code tương thích

---

## 7. Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `code: 214` / `payment gateway is not active` | Merchant chưa kích hoạt gateway | Activate tại PayOS dashboard |
| `"Illegal invocation"` | Dùng `@payos/node` SDK trong Workers | Dùng custom `workers/lib/payos.ts` (Web Crypto HMAC) |
| `"description: Mô tả tối đa 25 kí tự"` | Description > 25 ký tự | PayOS giới hạn 25 ký tự cho VietQR. Chỉ gửi tên tier. |
| `"Invalid webhook signature"` | Checksum key không match | Verify PAYOS_CHECKSUM_KEY giữa worker và PayOS dashboard |
| `"No pending invoice found"` | Payment link ID không khớp | Kiểm tra paymentLinkId trong webhook vs providerTxnId trong DB |
| Webhook không đến | Chưa cấu hình webhook URL | Cấu hình trong PayOS dashboard → Settings → Webhook |
| Test endpoints trả về HTML | Build chưa chạy | Chạy `pnpm build` trước `wrangler deploy` |
| Route `/api/v1/payments/checkout` trả về `"Invalid request body"` | Body không hợp lệ | Gửi `{"mailboxId":"email@domain.com","tier":"basic"}` |
| Route `/api/v1/payments/test` trả về SPA HTML | Route mounting issue | PayOS routes mount tại `/api/v1/payments`, dùng path tương đối |

### Lưu ý khi deploy

- Worker chạy từ `build/server/index.js`, **không phải** source `workers/*.ts`
- Luôn chạy `pnpm build` trước `wrangler deploy` (hoặc dùng `pnpm deploy`)
- Khi thêm/route mới, path phải tương đối với mount point (vd: `/checkout`, không `/api/v1/payments/checkout`)
