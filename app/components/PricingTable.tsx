import { Button } from "@cloudflare/kumo"
import { CheckIcon, CrownIcon, XIcon } from "@phosphor-icons/react"

interface PricingTier {
	name: string
	price: number
	features: string[]
	highlighted?: boolean
}

const TIERS: PricingTier[] = [
	{
		name: "Basic",
		price: 5,
		features: [
			"Access to public posts",
			"Basic content feed",
			"Community comments",
			"Vietnamese language support",
		],
	},
	{
		name: "Premium",
		price: 10,
		features: [
			"All Basic features",
			"Exclusive subscriber content",
			"Direct messaging with creator",
			"Priority support",
			"Early access to new content",
		],
		highlighted: true,
	},
	{
		name: "PPV Access",
		price: 0,
		features: [
			"$1–7 per post, pay as you go",
			"Unlock any locked content",
			"No monthly commitment",
			"Access to premium media sets",
			"One-time payment per unlock",
		],
	},
]

function formatUsd(amount: number) {
	if (amount === 0) return "—"
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(amount)
}

interface PricingTableProps {
	onSelect?: (tier: string) => void
	currentTier?: string
}

export default function PricingTable({
	onSelect,
	currentTier,
}: PricingTableProps) {
	return (
		<div className="grid gap-6 lg:grid-cols-3">
			{TIERS.map((tier) => {
				const isCurrent = currentTier?.toLowerCase() === tier.name.toLowerCase()

				return (
					<div
						key={tier.name}
						className={`relative flex flex-col rounded-2xl border p-6 shadow-sm transition-shadow hover:shadow-lg ${
							tier.highlighted
								? "border-kumo-brand bg-kumo-brand/5 ring-1 ring-kumo-brand"
								: isCurrent
									? "border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-300"
									: "border-kumo-line bg-kumo-base"
						}`}
					>
						{/* Badge */}
						{tier.highlighted && (
							<div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-kumo-brand px-4 py-1 text-xs font-semibold text-white">
								Most Popular
							</div>
						)}
						{isCurrent && !tier.highlighted && (
							<div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-1 text-xs font-semibold text-white">
								Current Plan
							</div>
						)}

						{/* Header */}
						<div className="mb-4 flex items-center gap-2">
							{tier.highlighted && (
								<CrownIcon size={20} className="text-kumo-brand" weight="fill" />
							)}
							<h3 className="text-lg font-bold text-kumo-default">
								{tier.name}
							</h3>
						</div>

						{/* Price */}
						<div className="mb-6">
							<span className="text-3xl font-bold text-kumo-default">
								{formatUsd(tier.price)}
							</span>
							<span className="ml-1 text-sm text-kumo-subtle">/month</span>
						</div>

						{/* Features */}
						<ul className="mb-8 flex-1 space-y-3">
							{tier.features.map((feature) => (
								<li
									key={feature}
									className="flex items-start gap-2 text-sm text-kumo-default"
								>
									<CheckIcon
										size={16}
										className="mt-0.5 shrink-0 text-kumo-brand"
										weight="bold"
									/>
									<span>{feature}</span>
								</li>
							))}
						</ul>

						{/* CTA */}
						{isCurrent ? (
							<Button
								variant="secondary"
								size="base"
								disabled
								className="w-full"
							>
								Current Plan
							</Button>
						) : (
							<Button
								variant={tier.highlighted ? "primary" : "secondary"}
								size="base"
								onClick={() => onSelect?.(tier.name.toLowerCase())}
								className="w-full"
							>
								{tier.highlighted ? "Get Started" : `Choose ${tier.name}`}
							</Button>
						)}
					</div>
				)
			})}
		</div>
	)
}

export { TIERS }
