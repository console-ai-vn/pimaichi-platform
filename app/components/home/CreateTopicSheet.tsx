import { Banner, Button, Input } from "@cloudflare/kumo";
import { ImageIcon, XIcon } from "@phosphor-icons/react";
import { useKumoToastManager } from "@cloudflare/kumo";
import { type FormEvent, useRef, useState } from "react";
import PendingImageAttachments from "~/components/home/PendingImageAttachments";
import {
	filesToFeedImages,
	MAX_TOPIC_IMAGE_FILES,
} from "~/lib/feed-images";
import { useCreateHomeTopic } from "~/queries/home-feed";
import RichTextEditor from "~/components/RichTextEditor";

export default function CreateTopicSheet({ onClose }: { onClose: () => void }) {
	const toast = useKumoToastManager();
	const createTopic = useCreateHomeTopic();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);

	const addFiles = (files: File[]) => {
		if (!files.length) return;
		setPendingFiles((current) => {
			const next = [...current, ...files];
			if (next.length > MAX_TOPIC_IMAGE_FILES) {
				setError(`You can attach up to ${MAX_TOPIC_IMAGE_FILES} images.`);
				return next.slice(0, MAX_TOPIC_IMAGE_FILES);
			}
			setError(null);
			return next;
		});
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);
		if (!title.trim()) {
			setError("Add a title.");
			return;
		}
		if (!body.trim() || body === "<p></p>") {
			setError("Add some content.");
			return;
		}
		try {
			const images = pendingFiles.length
				? await filesToFeedImages(
						pendingFiles,
						0,
						MAX_TOPIC_IMAGE_FILES,
					)
				: undefined;
			await createTopic.mutateAsync({
				title: title.trim(),
				body,
				images,
			});
			toast.add({ title: "Posted to feed!" });
			onClose();
		} catch (err: unknown) {
			const message =
				(err instanceof Error ? err.message : null) || "Could not create topic.";
			setError(message);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-2xl rounded-xl border border-kumo-line bg-kumo-base p-4 md:p-6 shadow-xl max-h-[90vh] overflow-y-auto"
			>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold text-kumo-default">Create post</h2>
					<Button
						type="button"
						variant="ghost"
						shape="square"
						icon={<XIcon size={18} />}
						onClick={onClose}
						aria-label="Close"
					/>
				</div>
				{error && <Banner variant="error" text={error} className="mb-3" />}
				<div className="space-y-3">
					<Input
						label="Title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="What's this about?"
						size="sm"
					/>
					<div>
						<span className="mb-1.5 block text-sm font-medium text-kumo-default">
							Content
						</span>
						<RichTextEditor value={body} onChange={setBody} />
					</div>
					<PendingImageAttachments
						files={pendingFiles}
						onRemove={(index) =>
							setPendingFiles((current) => current.filter((_, i) => i !== index))
						}
					/>
					<div className="flex justify-between gap-2">
						<Button
							type="button"
							variant="secondary"
							size="sm"
							icon={<ImageIcon size={16} />}
							onClick={() => fileInputRef.current?.click()}
							disabled={pendingFiles.length >= MAX_TOPIC_IMAGE_FILES}
						>
							Add images
						</Button>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/jpeg,image/png,image/webp"
							multiple
							className="hidden"
							onChange={(e) => {
								addFiles(Array.from(e.target.files ?? []));
								e.target.value = "";
							}}
						/>
						<Button
							type="submit"
							variant="primary"
							size="sm"
							disabled={createTopic.isPending}
						>
							{createTopic.isPending ? "Posting..." : "Post"}
						</Button>
					</div>
				</div>
			</form>
		</div>
	);
}