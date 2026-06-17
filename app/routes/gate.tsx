import { useNavigate, useParams } from "react-router"
import { useGateCheck, useGateUnlock } from "~/queries/gate"
import { useUserItems } from "~/queries/inventory"
import { useViewerEmail } from "~/hooks/useViewerEmail"
import GateOverlay from "~/components/GateOverlay"
import ContentTierBadge from "~/components/ContentTierBadge"

export default function GateRoute() {
	const { mailboxId, emailId } = useParams<{ mailboxId: string; emailId: string }>()
	const navigate = useNavigate()
	const viewerEmail = useViewerEmail()
	const { data: checkData, isLoading } = useGateCheck(mailboxId!, emailId!)
	const unlock = useGateUnlock(mailboxId!, emailId!)
	const { data: itemsData } = useUserItems(viewerEmail || "")

	const handleUnlock = async () => {
		if (!itemsData?.items || itemsData.items.length === 0) return

		const activeKey = itemsData.items.find(
			(item: Record<string, unknown>) =>
				item.status === "active" && item.item_type === "key"
		)

		if (!activeKey) {
			navigate(`/mailbox/${encodeURIComponent(mailboxId!)}/shop`)
			return
		}

		await unlock.mutateAsync(activeKey.id as string)
	}

	if (!mailboxId || !emailId) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-kumo-subtle">Invalid content reference</p>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-kumo-brand border-t-transparent" />
			</div>
		)
	}

	if (!checkData) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-kumo-subtle">Content not found</p>
			</div>
		)
	}

	const tier = (checkData.tier as "public" | "subscribers" | "ppv") || "public"

	if (checkData.allowed) {
		navigate(`/mailbox/${encodeURIComponent(mailboxId)}/emails/inbox?open=${encodeURIComponent(emailId)}`, { replace: true })
		return null
	}

	return (
		<div className="mx-auto max-w-2xl px-4 py-8">
			<div className="mb-4 flex items-center gap-2">
				<ContentTierBadge tier={tier} />
			</div>
			<GateOverlay
				contentTier={tier}
				keyPrice={checkData.keyPrice}
				onUnlock={handleUnlock}
				isLoading={unlock.isPending}
			/>
			{unlock.isError && (
				<p className="mt-4 text-center text-sm text-red-500">
					{(unlock.error as Error)?.message || "Failed to unlock content"}
				</p>
			)}
			{unlock.isSuccess && (
				<div className="mt-4 text-center">
					<p className="text-sm text-emerald-600">
						Content unlocked! Redirecting…
					</p>
				</div>
			)}
		</div>
	)
}
