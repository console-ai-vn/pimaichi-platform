// CF Images URL builder — constructs imagedelivery.net URLs
// Account hash is set via wrangler secret CF_IMAGES_ACCOUNT_HASH
// For production, the hash is injected at build time or hardcoded.
// Update ACCOUNT_HASH below with your actual hash from:
//   wrangler secret get CF_IMAGES_ACCOUNT_HASH

// CF Images URL builder — constructs imagedelivery.net URLs
// Account hash is configured via Vite define at build time.
// In production (wrangler deploy), the hash is injected from CF_IMAGES_ACCOUNT_HASH env var.
// Update the fallback below with your actual hash from Cloudflare Dashboard → Images → Developer Resources.

const ACCOUNT_HASH: string =
  (typeof import.meta !== "undefined" && (import.meta as Record<string, unknown>).env?.CF_IMAGES_ACCOUNT_HASH as string) ||
  "a23f698a1f594da1a6fb657c5bea74a8" // fallback — replace with Images account hash

const BASE = "https://imagedelivery.net"

type ImageVariant = "public" | "avatar" | "thumbnail" | "blur" | "w=200" | "w=400" | "w=800" | "w=1200"

const variantMap: Record<ImageVariant, string> = {
  public: "/public",
  avatar: "/avatar",
  thumbnail: "/thumbnail",
  blur: "/blur",
  "w=200": "/w=200",
  "w=400": "/w=400",
  "w=800": "/w=800",
  "w=1200": "/w=1200",
}

/**
 * Build a CF Images delivery URL.
 * @param imageId - The image ID/UUID from CF Images
 * @param variant - Named variant or size like "w=400"
 * @returns Full imagedelivery.net URL
 */
export function cfImageUrl(imageId: string | null | undefined, variant: ImageVariant = "public"): string {
  if (!imageId) return ""
  const v = variantMap[variant] || "/public"
  return `${BASE}/${ACCOUNT_HASH}/${imageId}${v}`
}

/**
 * Build a blurred placeholder URL for progressive loading.
 */
export function cfBlurUrl(imageId: string | null | undefined): string {
  return cfImageUrl(imageId, "blur")
}

/**
 * Build thumbnail URL (w=400, good for grid cards).
 */
export function cfThumbUrl(imageId: string | null | undefined): string {
  return cfImageUrl(imageId, "w=400")
}

/**
 * Build full preview URL (w=800, good for story viewer / preview modal).
 */
export function cfFullUrl(imageId: string | null | undefined): string {
  return cfImageUrl(imageId, "w=800")
}

/**
 * Check if a URL is already a CF Images delivery URL.
 */
export function isCfImageUrl(url: string): boolean {
  return url.includes("imagedelivery.net")
}

/**
 * Extract image ID from a CF Images delivery URL.
 */
export function extractImageId(url: string): string | null {
  if (!isCfImageUrl(url)) return null
  // Pattern: imagedelivery.net/{hash}/{imageId}/variant
  const parts = url.replace(BASE + "/", "").split("/")
  // parts[0] = hash, parts[1] = imageId
  return parts[1] || null
}
