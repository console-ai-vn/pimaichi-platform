# System Architecture — pimaichi1003 Classification Pipeline

## Overview

`
Instagram API
    |
    v
download.ps1 ──> images/ + posts_summary.json
                    |                          |
                    v                          v
         classify_images.py          classify_stories.py
                    |                          |
                    v                          v
         classified/                   classified_stories/
           01-portrait-selfie/            01-portrait-selfie/
           02-food-drink/                 04-family-friends/
           ...                            ...
           _reports/                      _reports/
              checkpoint.json                checkpoint.json
              classification_results.csv     classification_results.csv
              classification_results.json    classification_results.json
              classification_summary.txt     classification_summary.txt
`

## Data Flow

1. **Ingest:** download.ps1 fetches Instagram data via unofficial API → saves raw JSON + downloads media
2. **Parse:** posts_summary.json is extracted from ll_posts_raw.json (59 posts)
3. **Classify:** Each image/video is sent to Gemini 2.5 Flash Lite on Vertex AI
4. **Organize:** Files are moved (copy + delete) into category-named subdirectories
5. **Report:** Summary stats, CSV, and JSON are generated for downstream analysis

## Component Details

### classify_images.py
- Input: images/*.jpg + posts_summary.json (for captions)
- Processing: Sequential (1 file at a time to respect rate limits)
- State: Checkpoint file tracks progress for resume
- Output: Files moved to classified/{category}/, reports to classified/_reports/

### classify_stories.py
- Input: pimaichi1003_stories_dl/images/*.jpg + pimaichi1003_stories_dl/videos/*.mp4
- Processing: Same sequential pattern, unicode-safe logging
- Output: Files moved to classified_stories/{category}/, reports to classified_stories/_reports/

## External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| Python | 3.12+ | Runtime |
| google-genai | latest | Vertex AI / Gemini API client |
| Pillow (PIL) | latest | Image verification + opening |
| Google Cloud | — | Vertex AI backend (project: thuyduong-ssi-leads) |

## Vertex AI Configuration

- **Project ID:** thuyduong-ssi-leads
- **Location:** us-central1
- **Model:** gemini-2.5-flash-lite
- **Auth:** Application Default Credentials (gcloud auth application-default login)
- **Pricing:** ~.15/1K images (paid mode)
- **Free tier:** 49 images/day, 2 RPM (--free-tier flag)

## Error Handling

- Network errors: Retry with exponential backoff (5s, 10s, 20s, 40s)
- Corrupt files: Skip and log to checkpoint
- Rate limits: Pause and retry with longer delays
- Model errors: Re-query up to 4 times, fallback to "other"

## Security Notes

- No credentials stored in repository
- Vertex AI uses gcloud ADC (no embedded keys in scripts)
- Project is linked to a billing-enabled GCP account
