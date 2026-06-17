export function SkeletonCard() {
	return (
		<div className="animate-pulse rounded-2xl border border-kumo-line bg-kumo-base p-4">
			<div className="mb-3 h-40 w-full rounded-xl bg-kumo-fill" />
			<div className="space-y-2">
				<div className="h-4 w-3/4 rounded bg-kumo-fill" />
				<div className="h-3 w-1/2 rounded bg-kumo-fill" />
			</div>
		</div>
	)
}

export function SkeletonGrid({ count = 6, cols = 3 }: { count?: number; cols?: number }) {
	return (
		<div
			className="grid gap-4"
			style={{
				gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
			}}
		>
			{Array.from({ length: count }).map((_, i) => (
				<SkeletonCard key={i} />
			))}
		</div>
	)
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
	return (
		<div className="animate-pulse space-y-2">
			{Array.from({ length: lines }).map((_, i) => (
				<div
					key={i}
					className="h-3 rounded bg-kumo-fill"
					style={{ width: i === lines - 1 ? "60%" : "100%" }}
				/>
			))}
		</div>
	)
}

export function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
	const sizeMap = { sm: "size-8", md: "size-12", lg: "size-16" }
	return (
		<div
			className={`animate-pulse shrink-0 rounded-full bg-kumo-fill ${sizeMap[size]}`}
		/>
	)
}

export function SkeletonHero() {
	return (
		<div className="animate-pulse space-y-4">
			<div className="h-64 w-full rounded-2xl bg-kumo-fill" />
			<div className="flex gap-4">
				<div className="size-24 rounded-full bg-kumo-fill" />
				<div className="flex-1 space-y-2">
					<div className="h-6 w-1/3 rounded bg-kumo-fill" />
					<div className="h-4 w-2/3 rounded bg-kumo-fill" />
				</div>
			</div>
		</div>
	)
}

export function SkeletonPage() {
	return (
		<div className="animate-pulse space-y-6 p-4">
			<div className="h-10 w-1/4 rounded bg-kumo-fill" />
			<div className="h-80 w-full rounded-2xl bg-kumo-fill" />
			<div className="grid grid-cols-3 gap-4">
				{Array.from({ length: 6 }).map((_, i) => (
					<div key={i} className="h-40 rounded-xl bg-kumo-fill" />
				))}
			</div>
		</div>
	)
}
