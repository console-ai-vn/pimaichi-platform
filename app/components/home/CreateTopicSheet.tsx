import { Banner, Button, Input } from "@cloudflare/kumo";
import { ImageIcon, XIcon } from "@phosphor-icons/react";
import { useKumoToastManager } from "@cloudflare/kumo";
import { type FormEvent, useRef, useState } from "react";
import { filesToFeedImages } from "~/lib/feed-images";
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
				? await filesToFeedImages(pendingFiles)
				: undefined;
			await createTopic.mutateAsync({
				title: title.trim(),
				body,
				images,
			});
			toast.add({ title: "Topic posted!" });
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
					<h2 className="text-lg font-semibold text-kumo-default">New topic</h2>
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
					{pendingFiles.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{pendingFiles.map((file, index) => (
								<span
									key={`${file.name}-${index}`}
									className="rounded-full bg-kumo-fill px-2 py-1 text-xs text-kumo-subtle"
								>
									{file.name}
								</span>
							))}
						</div>
					)}
					<div className="flex justify-between gap-2">
						<Button
							type="button"
							variant="secondary"
							size="sm"
							icon={<ImageIcon size={16} />}
							onClick={() => fileInputRef.current?.click()}
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
								const files = Array.from(e.target.files ?? []);
								if (files.length) {
									setPendingFiles((current) => [...current, ...files]);
								}
								e.target.value = "";
							}}
						/>
						<Button
							type="submit"
							variant="primary"
							size="sm"
							disabled={createTopic.isPending}
						>
							{createTopic.isPending ? "Posting..." : "Post topic"}
						</Button>
					</div>
				</div>
			</form>
		</div>
	);
}