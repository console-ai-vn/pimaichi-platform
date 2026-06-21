# Hệ sinh thái Casso

> Công ty TNHH Casso — MST: 0316794479, cấp 07/04/2021 tại TP HCM
> Hạ tầng ngân hàng mở (Open Banking) cho Việt Nam

## Mục lục

1. [Tổng quan hệ sinh thái](#1-tổng-quan-hệ-sinh-thái)
2. [Sản phẩm chi tiết](#2-sản-phẩm-chi-tiết)
3. [Luồng tích hợp cho pimaichi-platform](#3-luồng-tích-hợp)
4. [Build gì được?](#4-build-gì-được)
5. [So sánh với giải pháp khác](#5-so-sánh)
6. [FAQ](#6-faq)

---

## 1. Tổng quan hệ sinh thái

### Công ty mẹ: Casso

- **Sứ mệnh:** Kiến tạo công nghệ tài chính mở
- **Đối tác NH chính thức:** VietinBank, OCB, MB Bank, ACB, BIDV, KienlongBank, ShinhanBank, PVcomBank
- **Chứng chỉ:** ISO/IEC 27001:2022, SOC 2/3, Google Cloud Platform
- **Hotline:** 1900 8144

### Sơ đồ hệ sinh thái

```
                    ┌──────────────────────────────────┐
                    │            CASSO                  │
                    │   (Công ty TNHH Casso)            │
                    │   Hạ tầng ngân hàng mở            │
                    └──────────┬───────────────────────┘
                               │
            ┌──────────────────┼──────────────────────┐
            │                  │                       │
    ┌───────┴───────┐  ┌──────┴──────┐  ┌─────────────┴──────┐
    │  For Dev      │  │  For Biz   │  │   For Citizen     │
    │               │  │            │  │                   │
    │  • VietQR     │  │ • payOS    │  │  • Cas ID         │
    │  • Cas (BaaS) │  │ • Flow     │  │                   │
    │               │  │ • Table    │  │                   │
    │               │  │ • Xpense   │  │                   │
    │               │  │ • X Invoice│  │                   │
    │               │  │ • X Bank   │  │                   │
    └───────────────┘  └────────────┘  └───────────────────┘
```

---

## 2. Sản phẩm chi tiết

### 2.1 Dành cho Developer

| Sản phẩm | URL | Mô tả | Dùng khi nào |
|----------|-----|-------|-------------|
| **VietQR** | vietqr.io | Bộ API tạo mã QR thanh toán chuẩn NHNN | Cần sinh QR động cho đơn hàng |
| **Cas** (bankHub) | cas.so / bankhub.dev | Banking as a Service — API hub kết nối app với ngân hàng | Làm fintech cần đọc giao dịch NH, xác thực tài khoản |

### 2.2 Dành cho Doanh nghiệp

| Sản phẩm | URL | Mô tả | Phí |
|----------|-----|-------|-----|
| **payOS** | payos.vn | Cổng thanh toán A2A — miễn phí, tiền về thẳng NH | **Free** (0đ trọn đời từ 01/2026) |
| **Casso Flow** | casso.vn/flow | Robot tài chính — tự động đồng bộ NH, webhook, bot chat, đối soát | Theo gói (có 14 ngày free) |
| **Casso Table** | casso.vn/table | Báo cáo tài chính đa tài khoản NH | Theo gói |
| **Casso Xpense** | casso.vn/casso-expense | Quản lý chi tiêu & ngân sách doanh nghiệp | Theo gói |
| **X Invoice** | xinvoice.vn | Hóa đơn điện tử miễn phí — tích hợp API xuất HĐ | **Free** |
| **X Bank** | (nhãn trắng) | Biến doanh nghiệp thành ngân hàng số AI | Liên hệ |

### 2.3 Dành cho Công dân

| Sản phẩm | URL | Mô tả | Phí |
|----------|-----|-------|-----|
| **Cas ID** (tên cũ: bankHub ID) | cas.so/cas-id | App quản lý tập trung tài khoản NH + cấp quyền cho app fintech | **Free** |
| **Ví Bảo Kim** (Baokim E-wallet) | baokim.vn / plus.baokim.vn | Ví điện tử — nguồn tiền cho payOS Chi hộ | **Free** |

### 2.4 Dành cho Ngân hàng

| Sản phẩm | URL | Mô tả |
|----------|-----|-------|
| **Loa X** | loax.vn | Loa thanh toán thông báo biến động số dư (nhãn trắng ngân hàng) |

---

## 3. Luồng tích hợp cho pimaichi-platform

### 3.1 Luồng cơ bản (thuần thu)

Chỉ cần fan đóng tiền, không cần trả cho creator:

```
Fan ──> payOS (thanh toán)
         │
         ├── QR / Link thanh toán
         ├── Fan chuyển khoản Napas 247
         │
         ▼
  Tiền về thẳng TK NH của bạn
         │
         ▼
  payOS Webhook ──> Server pimaichi
                    └── Cập nhật subscription/PPV status
```

**Cần:** payOS + Cas ID (kết nối NH vào payOS)

### 3.2 Luồng có Chi hộ (thu + trả hoa hồng creator)

```
Fan ──> payOS (THU) ──> TK NH bạn
                          │
                          ▼
  Server pimaichi gọi payOS Chi hộ API
                          │
                   ┌──────┴──────┐
                   ▼              ▼
            Ví Bảo Kim → Creator's NH
           (pre-fund)
```

**Cần:** payOS + Cas ID + Ví Bảo Kim + payOS Chi hộ

### 3.3 Luồng đầy đủ (thu + chi + đối soát + hóa đơn)

```
Fan ──> payOS ──> TK NH bạn
                    │
                    ├── Casso Flow (tự động kéo giao dịch về)
                    │   ├── Bot chat (Telegram/Slack)
                    │   ├── Webhook tùy chỉnh
                    │   └── Email báo cáo sáng
                    │
                    ├── payOS Chi hộ
                    │   └── Ví Bảo Kim → Creator
                    │
                    └── X Invoice (tự động xuất HĐĐT)
```

**Cần:** payOS + Cas ID + Ví Bảo Kim + Casso Flow + X Invoice

---

## 4. Build gì được?

### 4.1 Cổng thanh toán cho creator platform

Sản phẩm cần: **payOS**

- Subscription ($5/$10/tháng)
- PPV ($1-$7/lần)
- Tip
- Trial → auto-charge

### 4.2 Tự động trả hoa hồng / payout

Sản phẩm cần: **payOS Chi hộ + Ví Bảo Kim**

- Revenue share cho creator (70/30, 80/20...)
- Refund hoàn tiền
- Trả KOL, CTV sau này

### 4.3 Đối soát tự động + quản lý dòng tiền

Sản phẩm cần: **Casso Flow**

- Tự động tải giao dịch từ 10+ NH
- Bot chat thông báo biến động số dư
- Webhook kết nối với hệ thống nội bộ
- Email báo cáo doanh thu

### 4.4 Xuất hóa đơn điện tử tự động

Sản phẩm cần: **X Invoice**

- Khi fan subscription → tự động xuất HĐĐT
- Tích hợp API vào luồng thanh toán
- Miễn phí

### 4.5 Full-stack fintech platform

Sản phẩm cần: **Cas (BaaS) + payOS + Casso Flow + X Invoice**

- Tài khoản ảo (virtual account)
- Đọc giao dịch NH realtime
- Payment gateway + Payout + Invoice
- White-label banking (X Bank)

### 4.6 Ứng dụng tài chính cá nhân

Sản phẩm cần: **Cas (BaaS) + Casso Table**

- Tổng hợp đa tài khoản NH
- Báo cáo thu chi
- Phân tích tài chính

### 4.7 Web3 / Crypto + Fiat hybrid

Sản phẩm cần: **X Bank + payOS**

- Multi-currency + Web3 wallet
- Blockchain payments
- Cho vay AI-based

---

## 5. So sánh

### Casso vs Paypal

| Tiêu chí | Casso (payOS) | PayPal |
|----------|--------------|--------|
| Phí giao dịch | **0%** | ~4.4% + $0.30 |
| Đăng ký | CCCD, 5 phút | Passport, 1-3 ngày |
| Hỗ trợ HKD cá thể | ✅ Có | ❌ Cần business |
| Tiền về | Thẳng NH (A2A) | Giữ trong PayPal |
| Webhook | ✅ Realtime | ✅ IPN |
| Chi hộ | ✅ Qua Bảo Kim | ❌ |
| Hóa đơn VN | ✅ X Invoice | ❌ |

### Casso vs Stripe

| Tiêu chí | Casso (payOS) | Stripe |
|----------|--------------|-------|
| Phí | **0%** | 2.9% + $0.30 |
| Hỗ trợ VN | ✅ Bản địa, ngân hàng VN | ⚠️ Hạn chế |
| HKD cá thể | ✅ CCCD | ❌ |
| Payout | ✅ Chi hộ API | ✅ Connect |
| Webhook | ✅ | ✅ |
| 3D Secure | ✅ Napas 247 | ✅ |

---

## 6. FAQ

### Có cần GPKD để dùng payOS không?

Không. Chỉ cần CCCD cho cá nhân / HKD.

### Có cần GPKD cho Chi hộ không?

Không. Ví Bảo Kim hỗ trợ cả cá nhân, HKD, doanh nghiệp.

### Tiền từ payOS về đâu?

Về thẳng tài khoản ngân hàng bạn đã kết nối qua Cas ID. Không qua trung gian.

### PayOS có giữ tiền không?

Không. A2A (Account-to-Account) — tiền chuyển thẳng từ người mua → người bán.

### Chi hộ cần pre-fund bao nhiêu?

Tùy nhu cầu. Cần nạp vào Ví Bảo Kim trước khi gọi API chi. Nếu chi 10tr/tháng cho creator thì nạp 10tr.

### Các sản phẩm nào miễn phí?

- payOS: **miễn phí** (0đ trọn đời)
- Cas ID: **miễn phí**
- Ví Bảo Kim: **miễn phí**
- X Invoice: **miễn phí**

### Có thể tích hợp Casso Flow với luồng thanh toán không?

Không trực tiếp — Flow là tool quản lý dòng tiền nội bộ. Nhưng Flow có webhook có thể kết nối với server pimaichi để đối soát.

---

> Document này mapping toàn bộ hệ sinh thái Casso và cách apply vào pimaichi-platform.
> Cập nhật lần cuối: 21/06/2026
