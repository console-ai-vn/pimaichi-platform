#!/usr/bin/env node

/**
 * Backfill script for pimaichi1003 content.
 *
 * Reads posts_summary.json and the classified/ directory, then generates
 * backfill-data.json ready for D1 insertion.
 *
 * Usage:
 *   node scripts/backfill-pimaichi.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

// ── Config ────────────────────────────────────────────────────────────
const TALENT_DIR = resolve(import.meta.dirname, "..", "talent", "pimaichi1003");
const CLASSIFIED_DIR = join(TALENT_DIR, "classified");
const POSTS_JSON = join(TALENT_DIR, "posts_summary.json");
const OUTPUT_JSON = join(TALENT_DIR, "backfill-data.json");

// Category → tier mapping
const CATEGORY_TIER = {
  "01-portrait-selfie": "subscribers",
  "02-food-drink": "free",
  "03-landscape-outdoor": "free",
  "04-family-friends": "free",
  "05-object-still-life": "free",
  "06-pet-animal": "free",
  "07-text-screenshot": "free",
  "08-event-party": "subscribers",
  "09-fashion-style": "subscribers",
  "10-other": "free",
};

// Category display names
const CATEGORY_NAMES = {
  "01-portrait-selfie": "portrait-selfie",
  "02-food-drink": "food-drink",
  "03-landscape-outdoor": "landscape-outdoor",
  "04-family-friends": "family-friends",
  "05-object-still-life": "object-still-life",
  "06-pet-animal": "pet-animal",
  "07-text-screenshot": "text-screenshot",
  "08-event-party": "event-party",
  "09-fashion-style": "fashion-style",
  "10-other": "other",
};

// ── Helpers ───────────────────────────────────────────────────────────

/** Extract shortCode from filename (everything before first _) */
function shortCodeFromFilename(filename) {
  return filename.split("_")[0];
}

/** Determine if a filename is a "main" image, "imgN", or "cN" variant */
function classifyFileType(filename) {
  const base = filename.replace(/\.\w+$/, "");
  if (base.endsWith("_main")) return "main";
  if (base.includes("_img")) return "img";
  if (base.includes("_c")) return "crop";
  return "unknown";
}

// ── Main ──────────────────────────────────────────────────────────────

function main() {
  // 1. Read posts_summary
  let rawPosts;
  try {
    const raw = readFileSync(POSTS_JSON, "utf-8");
    // Strip BOM if present
    const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
    rawPosts = JSON.parse(clean);
    console.log(`Read ${rawPosts.length} posts from posts_summary.json`);
  } catch (err) {
    console.error(`Failed to read ${POSTS_JSON}:`, err.message);
    process.exit(1);
  }

  // Build a map: shortCode → post metadata
  const postMap = new Map();
  for (const post of rawPosts) {
    postMap.set(post.shortCode, post);
  }

  // 2. Scan classified directories
  let categoryDirs;
  try {
    categoryDirs = readdirSync(CLASSIFIED_DIR).filter(
      (name) => {
        if (name === "_reports") return false;
        return statSync(join(CLASSIFIED_DIR, name)).isDirectory();
      },
    );
  } catch (err) {
    console.error(`Failed to read ${CLASSIFIED_DIR}:`, err.message);
    process.exit(1);
  }

  // Collect all images grouped by shortCode
  // Map<shortCode, Array<{ filepath, category, fileType, filename }>>
  const imagesByPost = new Map();

  for (const dirName of categoryDirs) {
    const dirPath = join(CLASSIFIED_DIR, dirName);
    if (!statSync(dirPath).isDirectory()) continue;

    const files = readdirSync(dirPath).filter((f) =>
      /\.(jpg|jpeg|png|gif|webp|mp4)$/i.test(f),
    );

    for (const filename of files) {
      const shortCode = shortCodeFromFilename(filename);
      const fileType = classifyFileType(filename);

      if (!imagesByPost.has(shortCode)) {
        imagesByPost.set(shortCode, []);
      }
      imagesByPost.get(shortCode).push({
        filename,
        fileType,
        category: CATEGORY_NAMES[dirName] || "other",
        categoryDir: dirName,
        filepath: dirName + "/" + filename,
      });
    }
  }

  console.log(
    `Found ${imagesByPost.size} posts with classified media across ${categoryDirs.length} categories`,
  );

  // 3. Build output
  const posts = [];
  const mediaItems = [];
  let orphanedImages = 0;

  // Track which posts from posts_summary have media
  const postsWithMedia = new Set();

  for (const [shortCode, images] of imagesByPost) {
    const postMeta = postMap.get(shortCode);

    // Determine primary category and tier from first image's dominant category
    const categoryCounts = {};
    for (const img of images) {
      categoryCounts[img.category] = (categoryCounts[img.category] || 0) + 1;
    }
    // Pick the category with most images
    let primaryCategory = "other";
    let maxCount = 0;
    for (const [cat, count] of Object.entries(categoryCounts)) {
      if (count > maxCount) {
        maxCount = count;
        primaryCategory = cat;
      }
    }

    // Find which category dir produced this primary category
    let primaryCategoryDir = "10-other";
    for (const [dir, name] of Object.entries(CATEGORY_NAMES)) {
      if (name === primaryCategory) {
        primaryCategoryDir = dir;
        break;
      }
    }

    const tier = CATEGORY_TIER[primaryCategoryDir] || "free";

    // Generate stable post ID
    const postId = `pimaichi1003_${shortCode}`;
    postsWithMedia.add(shortCode);

    const postEntry = {
      id: postId,
      caption: postMeta?.caption || "",
      category: primaryCategory,
      likes: postMeta?.likesCount ?? 0,
      comments: postMeta?.commentsCount ?? 0,
      takenAt: postMeta?.timestamp || null,
      createdAt: postMeta?.timestamp || new Date().toISOString(),
      tier,
      ppvPrice: tier === "subscribers" ? 700 : null, // $7 in cents
      platform: "instagram",
      externalId: shortCode,
      isExclusive: 0,
      nsfwScore: null,
    };
    posts.push(postEntry);

    // Generate media entries for each image (skip crop variants)
    for (const img of images) {
      // Skip cropped variants (_cN), only include main and imgN
      if (img.fileType === "crop") continue;

      const mediaId = `media_${shortCode}_${img.filename.replace(/\.\w+$/, "")}`;
      const isMain = img.fileType === "main";
      const r2Key = `pimaichi1003/${img.filepath}`;

      mediaItems.push({
        id: mediaId,
        postId,
        type: "image",
        r2Key,
        contentType: "image/jpeg",
        sizeBytes: null,
        width: null,
        height: null,
        category: img.category,
        createdAt: postMeta?.timestamp || new Date().toISOString(),
      });
    }
  }

  // 4. Find posts from summary that have NO classified media
  const missingMediaPosts = [];
  for (const post of rawPosts) {
    if (!postsWithMedia.has(post.shortCode)) {
      // These posts have no classified images but exist in summary
      // Create them anyway with empty media array
      const postId = `pimaichi1003_${post.shortCode}`;
      const postEntry = {
        id: postId,
        caption: post.caption || "",
        category: "other",
        likes: post.likesCount ?? 0,
        comments: post.commentsCount ?? 0,
        takenAt: post.timestamp || null,
        createdAt: post.timestamp || new Date().toISOString(),
        tier: "free",
        ppvPrice: null,
        platform: "instagram",
        externalId: post.shortCode,
        isExclusive: 0,
        nsfwScore: null,
      };
      posts.push(postEntry);
      missingMediaPosts.push(post.shortCode);
    }
  }

  if (missingMediaPosts.length > 0) {
    console.log(
      `Added ${missingMediaPosts.length} posts from summary with no classified media (tier: free)`,
    );
  }

  // Log orphaned images (not in posts_summary)
  for (const [shortCode] of imagesByPost) {
    if (!postMap.has(shortCode)) {
      orphanedImages++;
    }
  }
  if (orphanedImages > 0) {
    console.log(`Warning: ${orphanedImages} shortCodes with classified images not in posts_summary`);
  }

  // 5. Write output
  const output = { posts, media: mediaItems };
  writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2), "utf-8");

  console.log(`\n✓ Backfill data written to ${OUTPUT_JSON}`);
  console.log(`  Posts: ${posts.length}`);
  console.log(`  Media entries: ${mediaItems.length}`);
  console.log(`\nSummary by tier:`);
  const tierCounts = {};
  for (const p of posts) {
    tierCounts[p.tier] = (tierCounts[p.tier] || 0) + 1;
  }
  for (const [tier, count] of Object.entries(tierCounts)) {
    console.log(`  ${tier}: ${count}`);
  }
}

main();
