# Project Overview & PDR — pimaichi1003

## Identity

**Handle:** pimaichi1003
**Platform:** Instagram
**Niche:** Lifestyle / Personal Branding — a young Vietnamese woman sharing daily life, self-portraits, family moments, food, and fashion.
**Content span:** ~Jan 2025 – Jun 2026 (1.5 years of activity)

---

## Content Statistics

### Posts (Main Feed)

| Metric | Value |
|--------|-------|
| Total posts | 59 |
| Image posts | 9 (15.3%) |
| Carousel posts | 47 (79.7%) |
| Video posts | 3 (5.1%) |
| Avg likes/post | 69.7 |
| Avg comments/post | 1.9 |
| Posts with captions | 13/59 (22%) |

### Posts — Classified Content Distribution (349 images)

| Category | Count | pct |
|----------|-------|-----|
| portrait-selfie | 270 | 77.4% |
| family-friends | 31 | 8.9% |
| other | 14 | 4.0% |
| object-still-life | 11 | 3.2% |
| food-drink | 10 | 2.9% |
| fashion-style | 5 | 1.4% |
| event-party | 4 | 1.1% |
| landscape-outdoor | 2 | 0.6% |
| text-screenshot | 2 | 0.6% |
| pet-animal | 0 | 0.0% |

### Stories (Highlights)

| Metric | Value |
|--------|-------|
| Total media | 61 (37 images + 24 videos) |
| Highlights | Arsenal, Dallas 2025, Travel, Daily Life |

### Stories — Classified Content Distribution (61 files)

| Category | Count | pct |
|----------|-------|-----|
| portrait-selfie | 27 | 44.3% |
| family-friends | 16 | 26.2% |
| text-screenshot | 6 | 9.8% |
| other | 5 | 8.2% |
| event-party | 3 | 4.9% |
| fashion-style | 2 | 3.3% |
| landscape-outdoor | 1 | 1.6% |
| object-still-life | 1 | 1.6% |

---

## Top Performing Posts

| Likes | Comments | Date | Caption |
|-------|----------|------|---------|
| 497 | 14 | 2026-06-08 | (video, no caption) |
| 301 | 5 | 2026-06-19 | (no caption) |
| 180 | 5 | 2026-03-05 | Family trip content |
| 140 | 4 | 2026-05-12 | "Mua he..." |
| 120 | 2 | 2026-03-26 | Daily life |

---

## Character Profile

- **Demographics:** Vietnamese woman, likely in her 20s-30s
- **Content style:** Heavy on self-portraits (77%), frequent family/friends appearances, occasional food and fashion
- **Language:** Vietnamese captions, minimal engagement (avg 2 comments/post)
- **Engagement trend:** Growing — earliest posts 30-60 likes, latest 140-497 likes
- **Story usage:** Active across multiple highlight categories — travel, sports (Arsenal FC), daily life
- **Personality cues:** Sentimental captions about family, life reflections, seasonal changes

---

## Data Sources

| Source | Format | Records |
|--------|--------|---------|
| Posts metadata | posts_summary.json | 59 posts |
| Raw API dump | all_posts_raw.json | Full API response |
| Classification results | classified/_reports/ | 349 images |
| Stories metadata | pimaichi1003_stories_dl/media_list.json | 61 media files |
| Stories classification | classified_stories/_reports/ | 61 files |

---

## Scripts

| Script | Purpose |
|--------|---------|
| classify_images.py | Classify post images via Vertex AI Gemini |
| classify_stories.py | Classify story images + videos via Vertex AI Gemini |
| reclassify.bat | Batch re-run (paid mode) |
| reclassify_resume.bat | Batch resume (free-tier mode) |
| download.ps1 | Original download script |

---

## Tech Stack

- **AI Model:** Gemini 2.5 Flash Lite (Vertex AI)
- **Runtime:** Python 3.12
- **Vision SDK:** google-genai (Vertex AI client)
- **Image Processing:** PIL/Pillow
- **Taxonomy:** 10 categories

---

## Marketing — OnlyFans Transition Plan

### Objectives

| Objective | Priority | Metric |
|-----------|----------|--------|
| Brand Awareness | High | Instagram follower growth, reach, saves |
| Sales Conversion | High | OnlyFans subscription rate (free -> paid) |
| Monetization | Critical | Monthly recurring revenue (MRR) |
| Market Expansion | Medium | Cross-platform reach (Twitter, Reddit) |
| Niche Positioning | Medium | "Mature but sexy" positioning recall |

### Target Audience

| Dimension | Profile |
|-----------|---------|
| Geography | Vietnam (domestic primary) |
| Gender | Male |
| Age | 18-35 |
| Psychographics | Men who admire mature, confident Vietnamese women; lifestyle & aesthetics consumers |
| Behavior | Instagram active, open to paid content, value personality over explicit material |

### Pricing Strategy

| Tier | Price | Access |
|------|-------|--------|
| Monthly | $5-$10/mo | Full feed + story archives |
| Promo / Trial | $3 (first month) | Limited-time launch discount |

- Anchor at $7/mo as primary tier
- Use $5 for price-sensitive markets (Vietnam domestic)
- $10 for premium tiers (behind-the-scenes, exclusive content)

### Competitive Positioning

**Positioning Statement:** *"pimaichi1003 — The mature, sophisticated Vietnamese woman next door who knows exactly what you want."*

| Dimension | pimaichi1003 | Competitors |
|-----------|-------------|-------------|
| Aesthetic | Mature + sexy ("lon tuoi nhung sexy") | Youth-focused / overly explicit |
| Content mix | 77% portrait-selfie (personal connection) | Less personal, more transactional |
| Origin story | Instagram lifestyle -> OnlyFans | Direct-to-OF, no brand foundation |
| Language | Vietnamese (authentic domestic connection) | English-heavy or generic |

### Brand Asset Requirements (New)

| Asset | Purpose | Notes |
|-------|---------|-------|
| Logo (wordmark) | Profile pic, watermark | Minimal, elegant, matching "mature sexy" vibe |
| Color palette | Consistent visual identity | Warm neutrals + accent (burgundy, gold) |
| Typography | Caption cards, banners | Serif for elegance, sans-serif for readability |
| Banner / cover art | OnlyFans profile header | 1600x400px, showcasing aesthetic |
| Teaser media kit | Instagram Stories, Twitter promo | 3-5 curated images + short bio |
| Watermark template | Protect all exported media | Semi-transparent, corner placement |
| Caption template | Consistent voice framework | Vietnamese primary, English optional |

### Brand Voice

- Tone: Warm, confident, slightly teasing
- Language: Vietnamese primary; optional English subtitles for expansion
- Personality: Mature older-sister energy — sophisticated but playful
- Prohibited: Desperate, overly explicit, aggressive sales

### Success Criteria (Marketing)

| Metric | 1-Month Target | 2-Month Target |
|--------|---------------|----------------|
| OnlyFans subscribers | 10-20 | 50-100 |
| Instagram -> OF click-through | 2-3% | 5-8% |
| Instagram engagement rate | 3-5% | 5-8% |
| Monthly recurring revenue | $50-$200 | $250-$1,000 |
