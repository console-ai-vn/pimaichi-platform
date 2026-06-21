import { Button } from "@cloudflare/kumo"
import { CheckIcon, CrownIcon } from "@phosphor-icons/react"

interface TierCardProps {
	name: string
	price: number
	features: string[]
	highlighted?: boolean
	onSelect: () => void
}

function formatUsd(amount: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(amount)
}

export default function TierCard({
	name,
	price,
	features,
	highlighted = false,
	onSelect,
}: TierCardProps) {
	return (
		<div
			className={`relative flex flex-col rounded-2xl border p-6 shadow-sm transition-shadow hover:shadow-md ${
				highlighted
					? "border-kumo-brand bg-kumo-brand/5 ring-1 ring-kumo-brand"
					: "border-kumo-line bg-kumo-base"
			}`}
		>
			{highlighted && (
				<div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-kumo-brand px-4 py-1 text-xs font-semibold text-white">
					Recommended
				</div>
			)}
			<div className="mb-4 flex items-center gap-2">
				{highlighted && <CrownIcon size={20} className="text-kumo-brand" />}
				<h3 className="text-lg font-bold text-kumo-default capitalize">{name}</h3>
			</div>
			<div className="mb-4">
				<span className="text-3xl font-bold text-kumo-default">
					{formatUsd(price)}
				</span>
				<span className="text-sm text-kumo-subtle">/mo</span>
			</div>
			<ul className="mb-6 flex-1 space-y-2">
				{features.map((feature) => (
					<li key={feature} className="flex items-start gap-2 text-sm text-kumo-default">
						<CheckIcon
							size={16}
							className="mt-0.5 shrink-0 text-kumo-brand"
							weight="bold"
						/>
						<span>{feature}</span>
					</li>
				))}
			</ul>
			<Button
				variant={highlighted ? "primary" : "secondary"}
				size="base"
				onClick={onSelect}
				className="w-full"
			>
				{highlighted ? "Get Started" : `Choose ${name}`}
			</Button>
		</div>
	)
}
