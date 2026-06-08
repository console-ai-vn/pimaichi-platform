import { Button } from "@cloudflare/kumo";
import { XIcon } from "@phosphor-icons/react";

interface PendingImageAttachmentsProps {
	files: File[];
	onRemove: (index: number) => void;
}

export default function PendingImageAttachments({
	files,
	onRemove,
}: PendingImageAttachmentsProps) {
	if (files.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-2">
			{files.map((file, index) => (
				<div
					key={`${file.name}-${file.size}-${index}`}
					className="group relative h-20 w-20 overflow-hidden rounded-lg border border-kumo-line bg-kumo-recessed"
				>
					<img
						src={URL.createObjectURL(file)}
						alt={file.name}
						className="h-full w-full object-cover"
					/>
					<Button
						type="button"
						variant="ghost"
						shape="square"
						size="sm"
						className="absolute right-1 top-1 bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
						icon={<XIcon size={12} />}
						onClick={() => onRemove(index)}
						aria-label={`Remove ${file.name}`}
					/>
				</div>
			))}
		</div>
	);
}