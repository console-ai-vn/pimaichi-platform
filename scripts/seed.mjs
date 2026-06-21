#!/usr/bin/env node
// Seed script to push image, video, story data to the platform

const BASE = "https://pimaichi-platform.ceo-23f.workers.dev"
const MAILBOX = "demo@onyx.com.vn"
const ADMIN = "admin@onyx.com.vn"

function svgDataUri(text, bg, fg, w, h) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${bg}"/>
    <text x="${w/2}" y="${h/2}" text-anchor="middle" dy=".35em"
          font-family="Arial,sans-serif" font-size="18" fill="${fg}">${text}</text>
  </svg>`
  const encoded = Buffer.from(svg).toString("base64")
  return { content: encoded, type: "image/svg+xml" }
}

async function api(path, opts = {}) {
  const url = BASE + path
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  })
  const body = res.status === 204 ? null : await res.text()
  let json = null
  try { json = body ? JSON.parse(body) : null } catch {}
  return { status: res.status, ok: res.ok, body, json }
}

async function step(label, fn) {
  process.stdout.write(`  ${label}... `)
  try {
    const result = await fn()
    process.stdout.write(result.ok ? `OK (${result.status})\n` : `FAIL (${result.status}): ${JSON.stringify(result.json || result.body)}\n`)
    return result
  } catch (e) {
    process.stdout.write(`ERROR: ${e.message}\n`)
    return { ok: false, status: 0, json: null, body: null }
  }
}

async function main() {
  console.log("\n=== SEEDING PIMAICHI PLATFORM ===\n")
  console.log(`Target: ${BASE}\n`)

  // 1. Ensure domains.json exists in R2
  console.log("[1] Platform config")
  await step("Set domains.json in R2 (done via wrangler earlier)", async () => ({ ok: true, status: 200 }))

  // 2. Create mailbox
  console.log("\n[2] Creating mailbox")
  let mailboxId = MAILBOX
  const createMailbox = await step(`Create mailbox ${MAILBOX}`, async () => {
    return api("/api/v1/mailboxes", {
      method: "POST",
      body: JSON.stringify({
        email: MAILBOX,
        name: "Demo Creator",
        settings: {
          fromName: "Demo Creator",
          isPublicBoard: true,
          bio: "✨ Welcome to my exclusive page! Daily photos, behind-the-scenes, and special content just for you.",
          website: "https://pimaichi.local",
          location: "Ho Chi Minh City, Vietnam",
          subscriptionTier: "premium",
        },
      }),
    })
  })
  if (createMailbox.status === 409) {
    console.log("    (already exists)")
  }

  // 3. Upload avatar and cover images
  console.log("\n[3] Uploading profile images")
  const avatar = svgDataUri("👤", "#6B21A8", "#FFFFFF", 256, 256)
  await step("Upload avatar", async () => {
    return api(`/api/v1/mailboxes/${encodeURIComponent(MAILBOX)}/avatar`, {
      method: "PUT",
      body: JSON.stringify(avatar),
    })
  })

  const cover = svgDataUri("🎬", "#1E1B4B", "#FFFFFF", 1200, 400)
  await step("Upload cover", async () => {
    return api(`/api/v1/mailboxes/${encodeURIComponent(MAILBOX)}/cover`, {
      method: "PUT",
      body: JSON.stringify(cover),
    })
  })

  // 4. Upload media images to R2
  console.log("\n[4] Uploading media images")
  const mediaImages = [
    { name: "sunset-beach.jpg", bg: "#FF6B35", text: "🏖️ Sunset" },
    { name: "city-night.jpg", bg: "#1A1A2E", text: "🌃 City Night" },
    { name: "coffee-morning.jpg", bg: "#8B4513", text: "☕ Coffee" },
    { name: "fitness-gym.jpg", bg: "#2D3436", text: "💪 Fitness" },
    { name: "travel-mountain.jpg", bg: "#2ECC71", text: "⛰️ Mountain" },
    { name: "food-gourmet.jpg", bg: "#E74C3C", text: "🍝 Pasta" },
    { name: "art-studio.jpg", bg: "#9B59B6", text: "🎨 Art" },
    { name: "music-session.jpg", bg: "#3498DB", text: "🎵 Music" },
  ]

  const uploadedMediaUrls = []
  for (const img of mediaImages) {
    const data = svgDataUri(img.text, img.bg, "#FFFFFF", 640, 640)
    const svgBytes = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640">
      <rect width="640" height="640" fill="${img.bg}"/>
      <text x="320" y="320" text-anchor="middle" dominant-baseline="central"
            font-family="Arial,sans-serif" font-size="48" fill="#FFFFFF">${img.text}</text>
    </svg>`)
    const form = new FormData()
    form.append("file", new Blob([svgBytes], { type: "image/svg+xml" }), img.name)
    form.append("meta", JSON.stringify({ filename: img.name, contentType: "image/svg+xml" }))

    const res = await step(`Upload ${img.name}`, async () => {
      const r = await fetch(`${BASE}/api/v1/media/upload/r2`, {
        method: "POST",
        body: form,
      })
      const body = await r.text()
      let json = null
      try { json = JSON.parse(body) } catch {}
      return { status: r.status, ok: r.ok, body, json }
    })
    if (res.ok && res.json?.url) {
      uploadedMediaUrls.push(res.json.url)
    }
  }

  // 5. Create inventory catalog items
  console.log("\n[5] Creating inventory catalog")
  const inventoryItems = [
    { type: "subscription", name: "Basic Tier", description: "Access to exclusive posts and stories", price: 99000, imageUrl: uploadedMediaUrls[0] || "" },
    { type: "subscription", name: "Premium Tier", description: "All Basic + private DMs + early access to content", price: 199000, imageUrl: uploadedMediaUrls[1] || "" },
    { type: "key", name: "Exclusive Photo Pack Vol.1", description: "20 high-resolution exclusive photos + behind-the-scenes", price: 149000, imageUrl: uploadedMediaUrls[2] || "" },
    { type: "key", name: "VIP Video Bundle", description: "5 exclusive videos including personal Q&A session", price: 299000, imageUrl: uploadedMediaUrls[3] || "" },
    { type: "tip", name: "Buy me a coffee ☕", description: "Show your appreciation with a small tip", price: 50000, imageUrl: "" },
    { type: "tip", name: "Generous Supporter", description: "For the dedicated fans who want extra love", price: 200000, imageUrl: "" },
  ]

  for (const item of inventoryItems) {
    await step(`Create ${item.type}: ${item.name}`, async () => {
      return api("/api/v1/inventory/catalog", {
        method: "POST",
        body: JSON.stringify({ creatorMailboxId: MAILBOX, ...item }),
      })
    })
  }

  // 6. Create a live event
  console.log("\n[6] Creating live event")
  const tomorrow = new Date(Date.now() + 86400000)
  await step("Schedule weekend live stream", async () => {
    return api("/api/v1/live/create", {
      method: "POST",
      body: JSON.stringify({
        creatorMailboxId: MAILBOX,
        title: "🎥 Weekend Hangout — Q&A Session",
        description: "Join me this weekend for a casual Q&A! I'll answer your questions, share some behind-the-scenes stories, and we can just hang out together. Premium subscribers get priority questions!",
        scheduledAt: tomorrow.toISOString(),
        passPrice: 0,
      }),
    })
  })

  // 7. Verify seed data
  console.log("\n[7] Verifying seed data")
  await step("GET /api/v1/config", async () => api("/api/v1/config"))
  await step("GET /api/v1/creator/top", async () => api("/api/v1/creator/top"))
  await step("GET /api/v1/feed", async () => api("/api/v1/feed"))
  await step("GET /api/v1/stories", async () => api("/api/v1/stories"))
  await step("GET /api/v1/inventory/catalog", async () => api("/api/v1/inventory/catalog"))

  console.log("\n=== SEED COMPLETE ===\n")
  console.log(`Mailbox:    ${MAILBOX}`)
  console.log(`Worker URL: ${BASE}`)
  console.log(`\nUploaded ${uploadedMediaUrls.length} media images`)
}

main().catch(console.error)
