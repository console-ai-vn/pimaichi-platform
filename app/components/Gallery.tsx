import { Empty, Loader } from "@cloudflare/kumo";
import { XIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

interface GalleryImage {
	id: string;
	url: string;
	title?: string;
}

interface GalleryProps {
	images: GalleryImage[];
	columns?: number;
}

function Lightbox({
	image,
	onClose,
}: {
	image: GalleryImage;
	onClose: () => void;
}) {
	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleKey);
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", handleKey);
			document.body.style.overflow = "";
		};
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
			onClick={onClose}
			role="dialog"
			aria-label="Image lightbox"
		>
			<button
				type="button"
				onClick={onClose}
				className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
				aria-label="Close lightbox"
			>
				<XIcon size={20} />
			</button>
			<img
				src={image.url}
				alt={image.title || "Image"}
				className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
				onClick={(e) => e.stopPropagation()}
			/>
		</div>
	);
}

function ImageCard({
	image,
	onClick,
}: {
	image: GalleryImage;
	onClick: () => void;
}) {
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState(false);

	return (
		<div className="relative overflow-hidden rounded-xl border border-kumo-line bg-kumo-recessed">
			{!loaded && !error && (
				<div className="absolute inset-0 flex items-center justify-center">
					<Loader size="sm" />
				</div>
			)}
			{error && (
				<div className="flex aspect-square items-center justify-center text-sm text-kumo-subtle">
					Failed to load
				</div>
			)}
			<button
				type="button"
				onClick={onClick}
				className="block w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-kumo-ring"
				aria-label={image.title || "View image"}
			>
				<img
					src={image.url}
					alt={image.title || "Image"}
					loading="lazy"
					className={`w-full object-cover transition-opacity ${
						loaded ? "opacity-100" : "opacity-0"
					}`}
					style={{ aspectRatio: "1 / 1" }}
					onLoad={() => setLoaded(true)}
					onError={() => setError(true)}
				/>
			</button>
			{image.title && (
				<div className="p-2">
					<p className="truncate text-xs text-kumo-subtle">{image.title}</p>
				</div>
			)}
		</div>
	);
}

export default function Gallery({ images, columns = 3 }: GalleryProps) {
	const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

	const handleClose = useCallback(() => setSelectedImage(null), []);

	if (images.length === 0) {
		return (
			<Empty
				title="No images yet"
				description="Upload images to see them here."
			/>
		);
	}

	const gridCols =
		columns === 2
			? "grid-cols-2"
			: columns === 4
				? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
				: columns === 5
					? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
					: "grid-cols-2 sm:grid-cols-3";

	return (
		<>
			<div className={`grid ${gridCols} gap-3`}>
				{images.map((image) => (
					<ImageCard
						key={image.id}
						image={image}
						onClick={() => setSelectedImage(image)}
					/>
				))}
			</div>
			{selectedImage && (
				<Lightbox image={selectedImage} onClose={handleClose} />
			)}
		</>
	);
}
