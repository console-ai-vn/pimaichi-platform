import {
	Button,
	Empty,
	Loader,
	useKumoToastManager,
} from "@cloudflare/kumo";
import { TrashIcon, UploadIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { useParams } from "react-router";
import Gallery from "~/components/Gallery";
import UploadProgress from "~/components/UploadProgress";
import VideoPlayer from "~/components/VideoPlayer";
import {
	useDeleteImage,
	useDeleteVideo,
	useImagesList,
	useImageUploadUrl,
	useStreamUploadUrl,
	useVideosList,
} from "~/queries/media";

export function meta() {
	return [{ title: "Media Library — ONYX" }];
}

function formatDuration(seconds: number): string {
	if (!seconds || seconds <= 0) return "--:--";
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
	try {
		return new Date(dateStr).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	} catch {
		return dateStr;
	}
}

export default function MediaRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const toastManager = useKumoToastManager();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [activeTab, setActiveTab] = useState<"videos" | "images">("videos");
	const [uploadFile, setUploadFile] = useState<File | null>(null);
	const [uploadUrl, setUploadUrl] = useState<string | null>(null);
	const [uploadKind, setUploadKind] = useState<"stream" | "images" | "r2">(
		"stream",
	);

	const { data: videos, isLoading: videosLoading } = useVideosList(mailboxId);
	const { data: images, isLoading: imagesLoading } = useImagesList(mailboxId);

	const streamUpload = useStreamUploadUrl();
	const imagesUpload = useImageUploadUrl();
	const deleteVideo = useDeleteVideo();
	const deleteImage = useDeleteImage();

	const handleFilePick = (kind: "stream" | "images") => {
		setUploadKind(kind);
		fileInputRef.current?.click();
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setUploadFile(file);

		try {
			if (uploadKind === "stream") {
				const result = await streamUpload.mutateAsync();
				setUploadUrl(result.uploadURL);
			} else {
				const result = await imagesUpload.mutateAsync();
				setUploadUrl(result.uploadURL);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to init upload";
			toastManager.add({ title: message, variant: "error" });
			setUploadFile(null);
		}

		// Reset file input
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleUploadComplete = () => {
		setUploadFile(null);
		setUploadUrl(null);
		toastManager.add({ title: "Upload complete" });
	};

	const handleUploadError = (error: string) => {
		setUploadFile(null);
		setUploadUrl(null);
		toastManager.add({ title: error, variant: "error" });
	};

	const handleDeleteVideo = async (videoId: string) => {
		try {
			await deleteVideo.mutateAsync(videoId);
			toastManager.add({ title: "Video deleted" });
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to delete video";
			toastManager.add({ title: message, variant: "error" });
		}
	};

	const handleDeleteImage = async (imageId: string) => {
		try {
			await deleteImage.mutateAsync(imageId);
			toastManager.add({ title: "Image deleted" });
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to delete image";
			toastManager.add({ title: message, variant: "error" });
		}
	};

	return (
		<div className="h-full overflow-y-auto bg-kumo-recessed">
			<div className="mx-auto max-w-3xl px-4 py-6">
				<div className="mb-6 flex items-center justify-between">
					<div>
						<h1 className="text-xl font-semibold text-kumo-default">
							Media library
						</h1>
						<p className="text-sm text-kumo-subtle">
							Manage your videos and images.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="secondary"
							size="sm"
							icon={<UploadIcon size={16} />}
							onClick={() => handleFilePick("stream")}
						>
							{streamUpload.isPending ? "..." : "Upload video"}
						</Button>
						<Button
							variant="primary"
							size="sm"
							icon={<UploadIcon size={16} />}
							onClick={() => handleFilePick("images")}
						>
							{imagesUpload.isPending ? "..." : "Upload image"}
						</Button>
					</div>
				</div>

				<input
					ref={fileInputRef}
					type="file"
					accept="video/*,image/*"
					className="hidden"
					onChange={(e) => void handleFileChange(e)}
				/>

				{uploadUrl && uploadFile && (
					<div className="mb-4">
						<UploadProgress
							uploadUrl={uploadUrl}
							file={uploadFile}
							onComplete={handleUploadComplete}
							onError={handleUploadError}
						/>
					</div>
				)}

				<div className="mb-4 flex border-b border-kumo-line">
					<button
						type="button"
						className={`px-4 py-2 text-sm font-medium transition-colors ${
							activeTab === "videos"
								? "border-b-2 border-kumo-brand text-kumo-brand"
								: "text-kumo-subtle hover:text-kumo-default"
						}`}
						onClick={() => setActiveTab("videos")}
					>
						Videos
					</button>
					<button
						type="button"
						className={`px-4 py-2 text-sm font-medium transition-colors ${
							activeTab === "images"
								? "border-b-2 border-kumo-brand text-kumo-brand"
								: "text-kumo-subtle hover:text-kumo-default"
						}`}
						onClick={() => setActiveTab("images")}
					>
						Images
					</button>
				</div>

				{activeTab === "videos" && (
					<>
						{videosLoading ? (
							<div className="flex justify-center py-16">
								<Loader />
							</div>
						) : !videos || videos.length === 0 ? (
							<Empty
								title="No videos yet"
								description="Upload your first video to get started."
							/>
						) : (
							<div className="grid gap-4 sm:grid-cols-2">
								{videos.map((video) => (
									<div
										key={video.uid}
										className="overflow-hidden rounded-xl border border-kumo-line bg-kumo-base shadow-sm"
									>
										<VideoPlayer videoId={video.uid} title={video.uid} />
										<div className="flex items-center justify-between p-3">
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<span
														className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
															video.status.state === "ready"
																? "bg-green-100 text-green-700"
																: "bg-yellow-100 text-yellow-700"
														}`}
													>
														{video.status.state === "ready"
															? "Ready"
															: video.status.state}
													</span>
													<span className="text-xs text-kumo-subtle">
														{formatDuration(video.duration)}
													</span>
												</div>
												<p className="mt-1 truncate text-xs text-kumo-subtle">
													{formatDate(video.created)}
												</p>
											</div>
											<Button
												variant="ghost"
												size="sm"
												icon={<TrashIcon size={14} />}
												onClick={() => handleDeleteVideo(video.uid)}
												loading={deleteVideo.isPending}
												aria-label="Delete video"
											/>
										</div>
									</div>
								))}
							</div>
						)}
					</>
				)}

				{activeTab === "images" && (
					<>
						{imagesLoading ? (
							<div className="flex justify-center py-16">
								<Loader />
							</div>
						) : !images || images.length === 0 ? (
							<Empty
								title="No images yet"
								description="Upload images to build your media library."
							/>
						) : (
							<div className="space-y-6">
								<div className="grid gap-3 sm:grid-cols-3">
									{images.map((image) => (
										<div
											key={image.id}
											className="group relative overflow-hidden rounded-xl border border-kumo-line bg-kumo-base"
										>
											<img
												src={
													image.variants?.[0] ||
													`/api/v1/media/images/${image.id}/variants`
												}
												alt={image.id}
												loading="lazy"
												className="aspect-square w-full object-cover"
											/>
											<div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
												<span className="text-xs text-white">
													{formatDate(image.uploaded)}
												</span>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleDeleteImage(image.id)}
													loading={deleteImage.isPending}
													className="text-white hover:bg-white/20"
													aria-label="Delete image"
												>
													<TrashIcon size={14} />
												</Button>
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
