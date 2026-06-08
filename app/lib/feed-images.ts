const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 8;

export interface FeedImageUpload {
	content: string;
	type: string;
}

function readFileAsBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
		reader.onload = () => {
			const result = String(reader.result || "");
			resolve(result.slice(result.indexOf(",") + 1));
		};
		reader.readAsDataURL(file);
	});
}

export async function filesToFeedImages(
	files: File[],
	existingCount = 0,
): Promise<FeedImageUpload[]> {
	if (existingCount + files.length > MAX_FILES) {
		throw new Error(`You can attach up to ${MAX_FILES} images.`);
	}

	const uploads: FeedImageUpload[] = [];
	for (const file of files) {
		if (!ALLOWED_TYPES.includes(file.type)) {
			throw new Error("Only JPEG, PNG, and WebP images are allowed.");
		}
		if (file.size > MAX_FILE_BYTES) {
			throw new Error(`${file.name} must be 4MB or smaller.`);
		}
		uploads.push({
			content: await readFileAsBase64(file),
			type: file.type,
		});
	}
	return uploads;
}