import { Button } from "@cloudflare/kumo"
import { LockIcon, LockKeyIcon } from "@phosphor-icons/react"
import type { ContentTier } from "./ContentTierBadge"

interface GateOverlayProps {
	contentTier: ContentTier
	keyPrice?: number
	previewUrl?: string
	onUnlock: () => Promise<void>
	isLoading: boolean
}

export default function GateOverlay({
	contentTier,
	keyPrice,
	previewUrl,
	onUnlock,
	isLoading,
}: GateOverlayProps) {
	if (contentTier === "public") return null

	return (
		<div className="relative overflow-hidden rounded-lg border border-kumo-line">
			{previewUrl && contentTier === "ppv" && (
				<div className="absolute inset-0">
					<img
						src={previewUrl}
						alt="Content preview"
						className="h-full w-full object-cover blur-xl"
					/>
					<div className="absolute inset-0 bg-kumo-base/70" />
				</div>
			)}

			<div className="relative flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
				{contentTier === "subscribers" ? (
					<>
						<LockIcon size={32} className="text-kumo-subtle" />
						<div>
							<p className="text-lg font-semibold text-kumo-default">
								Subscribe to view
							</p>
							<p className="mt-1 text-sm text-kumo-subtle">
								This content is available exclusively to subscribers.
							</p>
						</div>
						<Button
							variant="primary"
							size="base"
							onClick={() => {
								window.location.href = "/pricing"
							}}
						>
							View Pricing
						</Button>
					</>
				) : contentTier === "ppv" ? (
					<>
						<LockKeyIcon size={32} className="text-amber-500" />
						<div>
							<p className="text-lg font-semibold text-kumo-default">
								Unlock with 1 Key
							</p>
							<p className="mt-1 text-sm text-kumo-subtle">
								{keyPrice != null
									? `Spend 1 Key to unlock — Keys can be purchased in the shop`
									: "Use a Key from your inventory to view this content"}
							</p>
						</div>
						<Button
							variant="primary"
							size="base"
							onClick={onUnlock}
							disabled={isLoading}
						>
							{isLoading ? (
								<span className="inline-flex items-center gap-2">
									<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
									Unlocking…
								</span>
							) : (
								"Unlock with Key"
							)}
						</Button>
					</>
				) : null}
			</div>
		</div>
	)
}
