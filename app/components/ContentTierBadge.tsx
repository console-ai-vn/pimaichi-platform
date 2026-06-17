import { LockIcon, LockKeyIcon } from "@phosphor-icons/react"

export type ContentTier = "public" | "subscribers" | "ppv"

interface ContentTierBadgeProps {
	tier: ContentTier
}

const tierConfig: Record<ContentTier, { label: string; color: string; icon: React.ElementType }> = {
	public: {
		label: "Public",
		color:
			"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
		icon: () => null,
	},
	subscribers: {
		label: "Subscribers",
		color:
			"bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
		icon: LockIcon,
	},
	ppv: {
		label: "PPV",
		color:
			"bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
		icon: LockKeyIcon,
	},
}

export default function ContentTierBadge({ tier }: ContentTierBadgeProps) {
	const config = tierConfig[tier] ?? tierConfig.public
	const Icon = config.icon

	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${config.color}`}
		>
			{Icon !== (() => null) && <Icon size={12} weight="fill" />}
			{config.label}
		</span>
	)
}
