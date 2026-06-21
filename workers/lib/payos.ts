import type { Env } from "../types"

const BASE_URL = "https://api-merchant.payos.vn"

function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  ).then((cryptoKey) =>
    crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data))
  ).then((signature) => {
    const hashArray = Array.from(new Uint8Array(signature))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  })
}

function sortObjDataByKey(data: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {}
  Object.keys(data).sort().forEach((key) => { sorted[key] = data[key] })
  return sorted
}

function convertObjToQueryStr(data: Record<string, unknown>): string {
  return Object.keys(data).map((key) => `${key}=${data[key]}`).join("&")
}

async function createSignatureOfPaymentRequest(
  data: { amount: number; cancelUrl: string; description: string; orderCode: number; returnUrl: string },
  checksumKey: string,
): Promise<string> {
  const { amount, cancelUrl, description, orderCode, returnUrl } = data
  const dataStr = `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`
  return hmacSha256(checksumKey, dataStr)
}

async function createSignatureFromObj(data: Record<string, unknown>, checksumKey: string): Promise<string | null> {
  if (!data || !checksumKey.length) return null
  const sortedDataByKey = sortObjDataByKey(data)
  const dataQueryStr = convertObjToQueryStr(sortedDataByKey)
  return hmacSha256(checksumKey, dataQueryStr)
}

function generateOrderCode(): number {
  return (Date.now() % 1000000000) + Math.floor(Math.random() * 1000)
}

function vietqrImageUrl(bin: string, accountNumber: string, amount: number, description: string, accountName: string): string {
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: description,
    accountName,
  })
  return `https://img.vietqr.io/image/${bin}-${accountNumber}-compact2.png?${params.toString()}`
}

export interface PaymentLinkResult {
  paymentLinkId: string
  orderCode: number
  checkoutUrl: string
  qrCode: string
  qrImageUrl: string
  bin: string
  accountNumber: string
  accountName: string
  amount: number
  description: string
}

export async function createPaymentLink(
  env: Env,
  amount: number,
  description: string,
  cancelUrl: string,
  returnUrl: string,
): Promise<PaymentLinkResult> {
  const orderCode = generateOrderCode()
  const body = {
    orderCode,
    amount,
    description: description.slice(0, 100),
    cancelUrl,
    returnUrl,
  }

  const signature = await createSignatureOfPaymentRequest(body, env.PAYOS_CHECKSUM_KEY)
  const signedBody = { ...body, signature }

  const response = await fetch(`${BASE_URL}/v2/payment-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": env.PAYOS_CLIENT_ID,
      "x-api-key": env.PAYOS_API_KEY,
    },
    body: JSON.stringify(signedBody),
  })

  const rawJson = await response.json() as {
    code: string
    desc?: string
    data: {
      paymentLinkId: string
      orderCode: number
      checkoutUrl: string
      qrCode: string
      bin: string
      accountNumber: string
      accountName: string
      amount: number
      description: string
      signature?: string
    }
    signature?: string
  }

  if (rawJson.code !== "00" || !rawJson.data) {
    throw new Error(rawJson.desc || "PayOS create payment link failed")
  }

  const d = rawJson.data

  if (d.signature) {
    const verifySig = await createSignatureFromObj(
      { amount: d.amount, bin: d.bin, checkoutUrl: d.checkoutUrl, accountNumber: d.accountNumber, description: d.description, orderCode: d.orderCode, paymentLinkId: d.paymentLinkId, qrCode: d.qrCode, accountName: d.accountName },
      env.PAYOS_CHECKSUM_KEY,
    )
    if (verifySig !== d.signature) {
      throw new Error("PayOS response signature verification failed")
    }
  }

  return {
    paymentLinkId: d.paymentLinkId,
    orderCode: d.orderCode,
    checkoutUrl: d.checkoutUrl,
    qrCode: d.qrCode,
    qrImageUrl: vietqrImageUrl(d.bin, d.accountNumber, amount, description, d.accountName),
    bin: d.bin,
    accountNumber: d.accountNumber,
    accountName: d.accountName,
    amount: d.amount,
    description: d.description,
  }
}

export async function getPaymentLink(env: Env, paymentLinkId: string) {
  const response = await fetch(`${BASE_URL}/v2/payment-requests/${paymentLinkId}`, {
    headers: {
      "x-client-id": env.PAYOS_CLIENT_ID,
      "x-api-key": env.PAYOS_API_KEY,
    },
  })

  const rawJson = await response.json() as {
    code: string
    desc?: string
    data: {
      paymentLinkId: string
      orderCode: number
      checkoutUrl: string
      qrCode: string
      bin: string
      accountNumber: string
      accountName: string
      amount: number
      description: string
      status: string
    }
  }

  if (rawJson.code !== "00" || !rawJson.data) {
    throw new Error(rawJson.desc || "PayOS get payment link failed")
  }

  return rawJson.data
}

export async function verifyWebhookData(env: Env, webhookBody: unknown) {
  const { data, signature } = webhookBody as { data: Record<string, unknown>; signature?: string }

  if (!data) throw new Error("Invalid webhook: missing data")
  if (!signature) throw new Error("Invalid webhook: missing signature")

  const signedSignature = await createSignatureFromObj(data, env.PAYOS_CHECKSUM_KEY)
  if (!signedSignature || signedSignature !== signature) {
    throw new Error("Webhook data integrity check failed")
  }

  return data as {
    orderCode: number
    amount: number
    description: string
    accountNumber: string
    reference: string
    transactionDateTime: string
    paymentLinkId: string
    code: string
    desc: string
    counterAccountBankId: string
    counterAccountBankName: string
    counterAccountName: string
    counterAccountNumber: string
    virtualAccountName: string
    virtualAccountNumber: string
    currency: string
  }
}
