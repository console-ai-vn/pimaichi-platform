# Code Standards — pimaichi1003

## Python Style

- **Target:** Python 3.12
- **Naming:** snake_case for functions/variables, PascalCase for classes
- **Imports:** Standard lib first, then third-party (alphabetical within groups)
- **Error handling:** Retry with exponential backoff (2^attempt base), up to 4 attempts
- **File paths:** Derived from BASE_DIR = os.path.dirname(os.path.abspath(__file__)) — relative to script location

## Script Conventions

All classification scripts follow the same pattern:

1. **CLI args:** argparse with --paid, --free-tier, --dry-run, --resume, --model, --no-vertex
2. **Checkpoint:** JSON file at {output_dir}/_reports/checkpoint.json — saved after each image
3. **Rate limiting:** RateLimiter class — paid = 0.2s min interval, free-tier = 30s
4. **Reports:** CSV + JSON + summary text, saved to _reports/ after completion
5. **Move strategy:** shutil.copy2 + os.unlink (safe move via copy-then-delete)

## Taxonomy

10 content categories used consistently across posts and stories:

| Code | Name | Description |
|------|------|-------------|
| 01 | portrait-selfie | 1 person, face-focused |
| 02 | food-drink | Meals, drinks, cooking |
| 03 | landscape-outdoor | Scenery, nature, cityscape |
| 04 | family-friends | 2+ people, group shots |
| 05 | object-still-life | Objects, decor, flowers |
| 06 | pet-animal | Pets as main subject |
| 07 | text-screenshot | Screenshots, documents |
| 08 | event-party | Celebrations, concerts |
| 09 | fashion-style | Outfit/accessory focus |
| 10 | other | Anything not fitting above |

## Gemini Prompt Protocol

- **Model:** gemini-2.5-flash-lite (Vertex AI)
- **Prompt format:** Instructions block + media content (image bytes or video bytes)
- **Response parse:** Exact match against category list, then partial match via split
- **Fallback:** "other" after 4 failed attempts
- **Vertex AI auth:** GOOGLE_CLOUD_PROJECT env var + ADC (Application Default Credentials)

## Batch Files

- eclassify.bat: Sets GOOGLE_CLOUD_PROJECT, PYTHONIOENCODING=utf-8, runs both scripts in paid mode
- eclassify_resume.bat: Same but in free-tier + resume mode
