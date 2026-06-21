import os, json, re, time, csv, sys, shutil, random
from pathlib import Path
from datetime import datetime, date
from collections import defaultdict
from PIL import Image

import google.genai as genai

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(BASE_DIR, "images")
JSON_PATH = os.path.join(BASE_DIR, "posts_summary.json")
OUTPUT_DIR = os.path.join(BASE_DIR, "classified")
REPORTS_DIR = OUTPUT_DIR + "\\_reports"
CHECKPOINT_FILE = REPORTS_DIR + "\\checkpoint.json"

CATEGORIES = [
    "01-portrait-selfie",
    "02-food-drink",
    "03-landscape-outdoor",
    "04-family-friends",
    "05-object-still-life",
    "06-pet-animal",
    "07-text-screenshot",
    "08-event-party",
    "09-fashion-style",
    "10-other",
]

CATEGORY_NAMES = [c.split("-", 1)[1] for c in CATEGORIES]
CATEGORY_MAP = dict(zip(CATEGORY_NAMES, CATEGORIES))

PROMPT = """You are classifying Instagram photos into content categories.
Analyze the MAIN SUBJECT of this image.

Pick ONE category:
portrait-selfie, food-drink, landscape-outdoor, family-friends, object-still-life, pet-animal, text-screenshot, event-party, fashion-style, other

Rules:
- portrait-selfie: 1 person, face-focused (selfies, headshots, mirror selfies)
- food-drink: meals, drinks, cooking shots, coffee, restaurant
- landscape-outdoor: scenery, nature, beach, sky, cityscape, travel (people incidental)
- family-friends: 2+ people, group shots, couple photos
- object-still-life: objects, products, decor, flowers, flat lays, books
- pet-animal: pets/animals as main subject
- text-screenshot: screenshots, text messages, documents, memes, receipts
- event-party: celebrations, weddings, birthdays, concerts, festivals
- fashion-style: outfit focus, OOTD, clothing, accessories, shoe shots
- other: anything not fitting above (abstract, blurry, empty room)

Reply with ONLY the category name. No explanation, no punctuation."""


def load_posts_json():
    with open(JSON_PATH, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def build_caption_map(posts):
    m = {}
    for p in posts:
        m[p["shortCode"]] = (p.get("caption") or "").strip()
    return m


def extract_short_code(filename):
    m = re.match(r"(.+?)_(?:main|c\d+|img\d+)\.jpg$", filename)
    return m.group(1) if m else filename.replace(".jpg", "")


def get_all_images():
    files = [f for f in os.listdir(IMAGES_DIR) if f.lower().endswith(".jpg")]
    files.sort()
    return files


def verify_image(path):
    try:
        with Image.open(path) as img:
            img.verify()
        with Image.open(path) as img:
            w, h = img.size
            return w > 0 and h > 0
    except Exception:
        return False


def load_checkpoint():
    if not os.path.isfile(CHECKPOINT_FILE):
        return {"processed": {}, "errors": [], "skipped": []}
    with open(CHECKPOINT_FILE, "r") as f:
        return json.load(f)


def save_checkpoint(ckpt):
    os.makedirs(REPORTS_DIR, exist_ok=True)
    tmp = CHECKPOINT_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(ckpt, f, indent=2)
    os.replace(tmp, CHECKPOINT_FILE)


class RateLimiter:
    def __init__(self, mode="paid"):
        if mode == "paid":
            self.min_interval = 0.2
            self.daily_limit = 100000
        else:
            self.min_interval = 30.0
            self.daily_limit = 49
        self.last_request = 0.0
        self.requests_today = 0

    def wait(self):
        now = time.time()
        elapsed = now - self.last_request
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        if self.requests_today >= self.daily_limit:
            print(f"\nDaily limit ({self.daily_limit}) reached. Checkpoint saved.")
            raise StopIteration("daily_limit")
        self.last_request = time.time()
        self.requests_today += 1


def get_category_folder(category_name):
    return CATEGORY_MAP.get(category_name, "10-other")


def classify_image(client, img_path, caption, rate_limiter, model):
    rate_limiter.wait()
    contents = [PROMPT, Image.open(img_path)]
    if caption:
        contents = [
            "Instagram caption: " + caption + "\n\n" + PROMPT,
            Image.open(img_path),
        ]

    last_error = None
    for attempt in range(4):
        try:
            resp = client.models.generate_content(model=model, contents=contents)
            text = (resp.text or "").strip().lower().replace("-", "-")
            if text in CATEGORY_NAMES:
                return text, resp.usage_metadata
            parts = text.replace(",", " ").split()
            for p in parts:
                if p in CATEGORY_NAMES:
                    return p, resp.usage_metadata
            if attempt < 2:
                continue
            return "other", resp.usage_metadata
        except Exception as e:
            err = str(e)
            last_error = err
            if "RESOURCE_EXHAUSTED" in err or "429" in err:
                delay = (2**attempt) * 5
                print(f"\n  Quota hit, waiting {delay}s...")
                time.sleep(delay)
            elif "NOT_FOUND" in err:
                print(f"\n  Model error: {err[:100]}")
                time.sleep(5)
            else:
                delay = 2**attempt
                print(
                    f"\n  Error (attempt {attempt + 1}): {err[:80]}, retry in {delay}s"
                )
                time.sleep(delay)
    print(f"\n  Failed after retries, marking as other. Last: {last_error[:100]}")
    return "other", None


def organize_file(src_path, category_name, dry_run):
    src = Path(src_path)
    folder = get_category_folder(category_name)
    dest_dir = Path(OUTPUT_DIR) / folder
    dest = dest_dir / src.name
    if dest.exists():
        stem = dest.stem
        suffix = dest.suffix
        counter = 1
        while dest.exists():
            dest = dest_dir / f"{stem}_{counter}{suffix}"
            counter += 1
    if dry_run:
        return str(dest)
    os.makedirs(str(dest_dir), exist_ok=True)
    shutil.copy2(str(src), str(dest))
    if dest.exists():
        src.unlink()
    return str(dest)


def generate_reports(results, errors, total_time, model, dry_run):
    os.makedirs(REPORTS_DIR, exist_ok=True)
    csv_path = REPORTS_DIR + "\\classification_results.csv"
    json_path = REPORTS_DIR + "\\classification_results.json"
    summary_path = REPORTS_DIR + "\\classification_summary.txt"

    counts = defaultdict(int)
    for r in results:
        counts[r["category"]] += 1

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["filename", "shortCode", "category", "folder", "timestamp"])
        for r in results:
            w.writerow(
                [
                    r["filename"],
                    r["shortCode"],
                    r["category"],
                    r["folder"],
                    r["timestamp"],
                ]
            )

    json_output = {
        "model": model,
        "total": len(results),
        "errors": len(errors),
        "timestamp": datetime.now().isoformat(),
        "processing_time_seconds": round(total_time, 1),
        "distribution": dict(counts),
        "results": results,
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_output, f, indent=2, ensure_ascii=False)

    with open(summary_path, "w", encoding="utf-8") as f:
        f.write(f"Image Classification Summary\n")
        f.write(f"{'=' * 40}\n")
        f.write(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        f.write(f"Model: {model}\n")
        f.write(f"Total images: {len(results)}\n")
        f.write(f"Errors: {len(errors)}\n")
        f.write(f"Processing time: {round(total_time, 1)}s\n\n")
        f.write(f"Distribution:\n")
        for cat in CATEGORIES:
            display = cat.split("-", 1)[1]
            cnt = counts.get(display, 0)
            pct = cnt / len(results) * 100 if results else 0
            bar = "█" * int(pct / 2)
            f.write(f"  {cat:30s} {cnt:4d} ({pct:5.1f}%) {bar}\n")

    print(f"\nReports saved to {REPORTS_DIR}")
    return csv_path, json_path, summary_path


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Classify Instagram images with Gemini Vision"
    )
    parser.add_argument(
        "--paid", action="store_true", help="Paid tier (no daily limit)"
    )
    parser.add_argument(
        "--free-tier", action="store_true", help="Free tier (49/day, 2 RPM)"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Classify only, don't move files"
    )
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    parser.add_argument(
        "--model", default="gemini-2.5-flash-lite", help="Vertex AI model name"
    )
    parser.add_argument(
        "--no-vertex", action="store_true", help="Use API key instead of Vertex AI"
    )
    args = parser.parse_args()

    mode = "free-tier" if args.free_tier else "paid"
    if not args.paid and not args.free_tier:
        mode = "paid"

    if args.no_vertex:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            env_path = os.environ["USERPROFILE"] + "\\.env"
            if os.path.isfile(env_path):
                for line in open(env_path):
                    if line.startswith("GEMINI_API_KEY"):
                        api_key = line.split("=", 1)[1].strip()
                        break
        if not api_key:
            print(
                "ERROR: No GEMINI_API_KEY found. Set env var or use --no-vertex with key."
            )
            sys.exit(1)
        os.environ["GEMINI_API_KEY"] = api_key
        client = genai.Client()
    else:
        project = os.environ.get("GOOGLE_CLOUD_PROJECT", "thuyduong-ssi-leads")
        client = genai.Client(vertexai=True, project=project, location="us-central1")

    model = args.model
    print(f"Model: {model}")
    print(f"Mode: {mode}")
    print(f"Dry-run: {args.dry_run}")
    print(f"Images dir: {IMAGES_DIR}")

    posts = load_posts_json()
    caption_map = build_caption_map(posts)
    all_images = get_all_images()
    print(f"Total images: {len(all_images)}")
    print(f"Total posts: {len(posts)}")

    ckpt = (
        load_checkpoint()
        if args.resume
        else {"processed": {}, "errors": [], "skipped": []}
    )
    processed = ckpt.get("processed", {})
    errors_list = ckpt.get("errors", [])
    skipped = ckpt.get("skipped", [])

    if processed:
        print(
            f"Resuming: {len(processed)} already classified, {len(errors_list)} errors"
        )

    to_process = [f for f in all_images if f not in processed and f not in skipped]
    if not to_process:
        print("All images already classified!")
    else:
        print(f"To classify: {len(to_process)}")
        rate_limiter = RateLimiter(mode)
        start = time.time()

        try:
            for idx, filename in enumerate(to_process, 1):
                img_path = os.path.join(IMAGES_DIR, filename)
                short_code = extract_short_code(filename)
                caption = caption_map.get(short_code, "")

                if not verify_image(img_path):
                    print(
                        f"  [{idx}/{len(to_process)}] {filename}: corrupt image, skipping"
                    )
                    skipped.append(filename)
                    ckpt["skipped"] = skipped
                    save_checkpoint(ckpt)
                    continue

                category, usage = classify_image(
                    client, img_path, caption, rate_limiter, model
                )
                processed[filename] = {
                    "category": category,
                    "shortCode": short_code,
                    "folder": get_category_folder(category),
                    "model": model,
                    "timestamp": datetime.now().isoformat(),
                    "source": "caption" if caption else "vision",
                }
                if usage:
                    processed[filename]["prompt_tokens"] = getattr(
                        usage, "prompt_token_count", None
                    )
                    processed[filename]["candidate_tokens"] = getattr(
                        usage, "candidates_token_count", None
                    )

                ckpt["processed"] = processed
                ckpt["errors"] = errors_list
                ckpt["skipped"] = skipped
                save_checkpoint(ckpt)

                fn_short = filename[:35] + ".." if len(filename) > 35 else filename
                print(f"  [{idx}/{len(to_process)}] {fn_short:37s} -> {category}")

        except StopIteration:
            print(
                "\nDaily limit reached. Checkpoint saved. Run again tomorrow with --resume."
            )
            return

        total_time = time.time() - start
        print(f"\nClassification done in {round(total_time, 1)}s")
        print(
            f"Classified: {len(processed)}, Errors: {len(errors_list)}, Skipped: {len(skipped)}"
        )

    if args.dry_run:
        results_list = []
        for fn, data in processed.items():
            results_list.append(
                {
                    "filename": fn,
                    "shortCode": data["shortCode"],
                    "category": data["category"],
                    "folder": data["folder"],
                    "timestamp": data["timestamp"],
                }
            )
        generate_reports(results_list, errors_list, 0, model, dry_run=True)
        print("\nDry-run complete. No files moved.")
        print("Distribution:")

        counts = defaultdict(int)
        for r in results_list:
            counts[r["category"]] += 1
        for cat in CATEGORIES:
            display = cat.split("-", 1)[1]
            cnt = counts.get(display, 0)
            if results_list:
                pct = cnt / len(results_list) * 100
                bar = "█" * int(pct / 2)
                print(f"  {cat:30s} {cnt:4d} ({pct:5.1f}%) {bar}")
        return

    # Move files
    moved = 0
    errors_move = 0
    print("\nOrganizing files...")
    for fn, data in processed.items():
        src_path = os.path.join(IMAGES_DIR, fn)
        if not os.path.isfile(src_path):
            continue
        try:
            dest = organize_file(src_path, data["category"], dry_run=False)
            moved += 1
        except Exception as e:
            print(f"  Error moving {fn}: {e}")
            errors_move += 1

    print(f"Moved: {moved}, Errors: {errors_move}")

    results_list = []
    for fn, data in processed.items():
        results_list.append(
            {
                "filename": fn,
                "shortCode": data["shortCode"],
                "category": data["category"],
                "folder": data["folder"],
                "timestamp": data["timestamp"],
            }
        )

    csv_path, json_path, summary_path = generate_reports(
        results_list, errors_list, time.time() - start, model, dry_run=False
    )

    remaining = [f for f in os.listdir(IMAGES_DIR) if f.lower().endswith(".jpg")]
    print(f"\nRemaining in source: {len(remaining)}")

    if os.path.isfile(CHECKPOINT_FILE) and not remaining:
        os.remove(CHECKPOINT_FILE)
        print("Checkpoint removed (all done).")

    print(
        f"\nDone! {len(results_list)} images classified into {len(CATEGORIES)} categories."
    )
    print(f"CSV: {csv_path}")
    print(f"JSON: {json_path}")
    print(f"Summary: {summary_path}")


if __name__ == "__main__":
    main()
