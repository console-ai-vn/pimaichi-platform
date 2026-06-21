# pimaichi1003 — Instagram Content Analysis

AI-powered content classification for Instagram account **pimaichi1003** (Vietnamese lifestyle influencer). Classifies 410 media files into 10 content categories using Gemini 2.5 Flash Lite on Vertex AI.

## Quick Start

`ash
# Full classification (paid mode)
.\reclassify.bat

# Resume from checkpoint (free tier, 49/day)
.\reclassify_resume.bat
`

## Data Overview

| Dataset | Files | Categories | Top Category |
|---------|-------|------------|-------------|
| Posts (59 posts) | 349 images | 9 | portrait-selfie (77.4%) |
| Stories (highlights) | 61 (37 img + 24 vid) | 8 | portrait-selfie (44.3%) |

## Project Structure

`
├── images/                        # Source post images
├── pimaichi1003_stories_dl/       # Source story media
├── classified/                    # Classified posts by category
├── classified_stories/            # Classified stories by category
├── docs/                          # Documentation
│   ├── project-overview-pdr.md    # Project overview & PDR
│   ├── codebase-summary.md        # Codebase structure
│   ├── code-standards.md          # Code standards & taxonomy
│   └── system-architecture.md     # System architecture
├── posts_summary.json             # Post metadata (59 posts)
├── classify_images.py             # Post classification script
├── classify_stories.py            # Story classification script
├── reclassify.bat                 # Batch re-run (paid mode)
└── reclassify_resume.bat          # Batch resume (free-tier mode)
`

## Key Features

- **AI-powered:** Gemini 2.5 Flash Lite via Vertex AI
- **Resilient:** Checkpoint/resume, retry with backoff, corruption detection
- **Dual-mode:** Paid (unlimited) or free-tier (49/day)
- **Dual-dataset:** Posts + Stories (including video)
- **Reports:** CSV, JSON, and human-readable summary

## Tech Stack

- **Runtime:** Python 3.12
- **AI:** Gemini 2.5 Flash Lite (Vertex AI, project thuyduong-ssi-leads)
- **SDK:** google-genai, Pillow
- **Auth:** gcloud Application Default Credentials

## Taxonomy

10 categories: portrait-selfie, food-drink, landscape-outdoor, family-friends, object-still-life, pet-animal, text-screenshot, event-party, fashion-style, other

## Docs

See [docs/](docs/) for full documentation.

---

## Marketing Context — OnlyFans Transition

This project includes a marketing strategy to transition **pimaichi1003** from Instagram lifestyle influencer to OnlyFans creator.

| Area | Summary |
|------|---------|
| **Objective** | Monetize existing 77% selfie-content audience |
| **Target** | Vietnamese males 18-35 |
| **Pricing** | $5-$10/month (anchor $7) |
| **Timeline** | 2 months (launch Aug 2026) |
| **Budget** | < $500 |
| **Positioning** | "Mature but sexy" Vietnamese aesthetic |
| **Channels** | Instagram (primary), Twitter, Reddit |

### Marketing Documents

| File | Purpose |
|------|---------|
| `docs/marketing-overview.md` | Full strategy: funnel, channels, content pillars, pricing, roadmap |
| `docs/project-roadmap.md` | Week-by-week timeline with milestones and KPIs |
| `docs/project-overview-pdr.md` | Project overview with appended marketing section |

### Quick Links

- [Marketing Strategy](docs/marketing-overview.md)
- [Project Roadmap](docs/project-roadmap.md)
- [Project Overview & PDR](docs/project-overview-pdr.md)
