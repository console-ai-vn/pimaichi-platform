import { Button } from "@cloudflare/kumo"
import { LockIcon, LockKeyIcon, X } from "@phosphor-icons/react"
import { cfFullUrl, cfBlurUrl } from "~/lib/cf-images"
import type { ContentTier } from "~/components/ContentTierBadge"

interface PreviewItem {
	id: string
	thumbnailUrl?: string | null
	imageId?: string | null
	title: string
	tier: ContentTier
	isUnlocked: boolean
	previewText?: string | null
}

interface PreviewModalProps {
	item: PreviewItem
	visible: boolean
	onClose: () => void
	onSubscribe?: () => void
	onUnlock?: () => void
}

/**
 * Modal overlay showing larger preview of content card.
 * Blur if gated, with "Subscribe to view" or "Unlock with Key" CTA.
 */
export default function PreviewModal({
	item,
	visible,
	onClose,
	onSubscribe,
	onUnlock,
}: PreviewModalProps) {
	if (!visible) return null

	const imgSrc = cfFullUrl(item.imageId) || item.thumbnailUrl || ""
	const blurSrc = cfBlurUrl(item.imageId)
	const isGated = !item.isUnlocked && item.tier !== "public"

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			{/* Backdrop */}
			<button
				type="button"
				onClick={onClose}
				className="absolute inset-0 bg-black/80 backdrop-blur-sm"
				aria-label="Close preview"
			/>

			{/* Modal content */}
			<div className="animate-scale-in relative z-10 flex max-h-[90vh] max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-kumo-base shadow-2xl">
				{/* Image area */}
				<div className="relative aspect-[3/4] w-full overflow-hidden bg-kumo-fill sm:aspect-auto sm:max-h-[60vh]">
					{imgSrc ? (
						<>
							{blurSrc && (
								<img
									src={blurSrc}
									alt=""
									className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
									aria-hidden="true"
								/>
							)}
							<img
								src={imgSrc}
								alt={item.title}
								className={`relative z-10 h-full w-full object-cover ${
									isGated ? "blur-xl" : ""
								}`}
							/>
						</>
					) : (
						<div className="flex h-full w-full items-center justify-center">
							<p className="text-kumo-subtle">No preview available</p>
						</div>
					)}

					{/* Dim overlay for gated */}
					{isGated && (
						<div className="absolute inset-0 z-20 bg-black/50" />
					)}

					{/* Close button */}
					<button
						type="button"
						onClick={onClose}
						className="absolute right-3 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
						aria-label="Close"
					>
						<X size={16} weight="bold" />
					</button>
				</div>

				{/* Info + CTA */}
				<div className="p-4">
					<h3 className="text-lg font-semibold text-kumo-default">
						{item.title}
					</h3>

					{item.previewText && (
						<p className="mt-1 text-sm text-kumo-subtle line-clamp-3">
							{item.previewText}
						</p>
					)}

					{isGated && (
						<div className="mt-4 flex flex-col gap-3">
							<div className="flex items-center gap-3 rounded-lg bg-kumo-fill p-3">
								{item.tier === "subscribers" ? (
									<LockIcon
										size={20}
										className="text-kumo-subtle shrink-0"
									/>
								) : (
									<LockKeyIcon
										size={20}
										className="text-amber-500 shrink-0"
									/>
								)}
								<div>
									<p className="text-sm font-medium text-kumo-default">
										{item.tier === "subscribers"
											? "Subscribe to view"
											: "Unlock this content"}
									</p>
									<p className="text-xs text-kumo-subtle">
										{item.tier === "subscribers"
											? "This content is available exclusively to subscribers."
											: "Use a Key from your inventory to view this content."}
									</p>
								</div>
							</div>

							{item.tier === "subscribers" && onSubscribe && (
								<Button
									variant="primary"
									size="base"
									onClick={onSubscribe}
									className="w-full"
								>
									Subscribe Now
								</Button>
							)}

							{item.tier === "ppv" && onUnlock && (
								<Button
									variant="primary"
									size="base"
									onClick={onUnlock}
									className="w-full"
								>
									Unlock with Key
								</Button>
							)}
						</div>
					)}

					{!isGated && (
						<p className="mt-2 text-xs text-emerald-500">
							This content is unlocked for you
						</p>
					)}
				</div>
			</div>
		</div>
	)
}
