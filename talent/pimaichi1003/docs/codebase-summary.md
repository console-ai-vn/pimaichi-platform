# Codebase Summary — pimaichi1003

## Directory Structure

`
pimaichi1003_dl/
├── images/                          # Source post images (349 JPGs)
├── pimaichi1003_stories_dl/         # Source story media
│   ├── images/                      #   37 JPGs
│   ├── videos/                      #   24 MP4s
│   ├── media_list.json              #   Story metadata
│   └── media_list.csv               #   Story metadata (CSV)
├── classified/                      # Classified posts output
│   ├── 01-portrait-selfie/          #   270 files
│   ├── 02-food-drink/               #   10 files
│   ├── ...                          #   Other categories
│   └── _reports/                    #   CSV + JSON + summary
├── classified_stories/              # Classified stories output
│   ├── 01-portrait-selfie/          #   27 files
│   ├── 04-family-friends/           #   16 files
│   ├── ...                          #   Other categories
│   └── _reports/                    #   CSV + JSON + summary
├── docs/                            # Documentation
├── posts_summary.json               # 59 posts metadata
├── posts_summary.csv                # 59 posts metadata (CSV)
├── all_posts_raw.json               # Raw Instagram API dump
├── classify_images.py               # Post classification script
├── classify_stories.py              # Story classification script
├── reclassify.bat                   # Batch re-run (paid)
├── reclassify_resume.bat            # Batch resume (free-tier)
└── download.ps1                     # Original download script
`

## File Inventory

| Extension | Count | Purpose |
|-----------|-------|---------|
| .jpg | 410 | Source images (349 posts + 37 stories + 24 video thumbs) |
| .mp4 | 24 | Story videos |
| .json | 4 | Metadata + raw API data |
| .csv | 2 | Metadata + classification reports |
| .py | 2 | Classification scripts |
| .bat | 2 | Re-run wrappers |
| .ps1 | 1 | Original download |

## Total Size

- Source data: ~56 MB (images + videos)
- Classified output: ~0 bytes (symlinks/copies removed after move)
- Scripts: ~20 KB

## Key Files Explained

### classify_images.py (468 lines)
Classifies post images using Vertex AI Gemini. Features:
- Checkpoint/resume for fault tolerance
- Dry-run mode (no file moves)
- Rate limiter (paid: 0.2s interval, free-tier: 30s)
- Caption-augmented prompt
- Retry with exponential backoff
- Generates CSV, JSON, and summary reports

### classify_stories.py (493 lines)
Same engine adapted for Instagram Stories. Additional features:
- Handles both images (PIL) and videos (raw bytes via Part.from_bytes)
- Unicode-safe file path printing
- Separate checkpoint namespace
