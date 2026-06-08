import { Banner, Button } from "@cloudflare/kumo";
import { ImageIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { type FormEvent, useRef, useState } from "react";
import { filesToFeedImages } from "~/lib/feed-images";
import { useCreateHomeComment } from "~/queries/home-feed";

export default function CommentComposer({ topicId }: { topicId: string }) {
	const createComment = useCreateHomeComment(topicId);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [body, setBody] = useState("");
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);
		const trimmed = body.trim();
		if (!trimmed && pendingFiles.length === 0) {
			setError("Write a comment or attach an image.");
			return;
		}
		try {
			const images = pendingFiles.length
				? await filesToFeedImages(pendingFiles)
				: undefined;
			const html = trimmed
				? `<p>${trimmed.replace(/\n/g, "<br>")}</p>`
				: "<p></p>";
			await createComment.mutateAsync({ body: html, images });
			setBody("");
			setPendingFiles([]);
		} catch (err: unknown) {
			setError((err instanceof Error ? err.message : null) || "Could not post comment.");
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-2 border-t border-kumo-line pt-4">
			{error && <Banner variant="error" text={error} />}
			<textarea
				className="min-h-20 w-full resize-y rounded-lg border border-kumo-line bg-kumo-recessed px-3 py-2 text-sm text-kumo-default placeholder:text-kumo-subtle focus:outline-none focus:ring-1 focus:ring-kumo-ring"
				placeholder="Write a comment..."
				value={body}
				onChange={(e) => setBody(e.target.value)}
			/>
			{pendingFiles.length > 0 && (
				<p className="text-xs text-kumo-subtle">
					{pendingFiles.length} image(s) attached
				</p>
			)}
			<div className="flex justify-between gap-2">
				<Button
					type="button"
					variant="secondary"
					size="sm"
					icon={<ImageIcon size={16} />}
					onClick={() => fileInputRef.current?.click()}
				>
					Image
				</Button>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/jpeg,image/png,image/webp"
					multiple
					className="hidden"
					onChange={(e) => {
						const files = Array.from(e.target.files ?? []);
						if (files.length) setPendingFiles((current) => [...current, ...files]);
						e.target.value = "";
					}}
				/>
				<Button
					type="submit"
					variant="primary"
					size="sm"
					icon={<PaperPlaneTiltIcon size={16} />}
					disabled={createComment.isPending}
				>
					{createComment.isPending ? "Posting..." : "Comment"}
				</Button>
			</div>
		</form>
	);
}