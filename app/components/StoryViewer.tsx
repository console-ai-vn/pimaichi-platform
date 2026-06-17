import { useCallback, useEffect, useRef, useState } from "react"
import { X } from "@phosphor-icons/react"
import { cfFullUrl } from "~/lib/cf-images"
import type { Story } from "~/queries/feed"

interface StoryViewerProps {
	stories: Story[]
	initialIndex: number
	onClose: () => void
	onNextCreator?: () => void
}

const STORY_DURATION = 5000 // 5s per story
const PROGRESS_SEGMENTS = 30

/**
 * Full-screen story viewer overlay (Instagram-style).
 * Tap left → previous, tap right → next, hold → pause.
 * Auto-advances every 5s with segmented progress bar.
 * Preloads next 2 images.
 */
export default function StoryViewer({
	stories,
	initialIndex,
	onClose,
}: StoryViewerProps) {
	const [currentIdx, setCurrentIdx] = useState(initialIndex)
	const [progress, setProgress] = useState(0)
	const [isPaused, setIsPaused] = useState(false)
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const startTimeRef = useRef(Date.now())
	const elapsedBeforePause = useRef(0)

	const currentStory = stories[currentIdx]

	// Preload next 2 images
	useEffect(() => {
		for (let i = 1; i <= 2; i++) {
			const nextIdx = currentIdx + i
			if (nextIdx < stories.length) {
				const story = stories[nextIdx]
				const src = cfFullUrl(story.imageId) || story.imageUrl
				if (src) {
					const img = new Image()
					img.src = src
				}
			}
		}
	}, [currentIdx, stories])

	// Auto-advance timer
	const startTimer = useCallback(() => {
		if (timerRef.current) clearInterval(timerRef.current)
		startTimeRef.current = Date.now()

		timerRef.current = setInterval(() => {
			const elapsed = Date.now() - startTimeRef.current + elapsedBeforePause.current
			const pct = Math.min((elapsed / STORY_DURATION) * 100, 100)
			setProgress(pct)

			if (pct >= 100) {
				goToNext()
			}
		}, 50)
	}, [])

	const goToNext = useCallback(() => {
		if (currentIdx < stories.length - 1) {
			setProgress(0)
			elapsedBeforePause.current = 0
			setCurrentIdx((p) => p + 1)
		} else {
			onClose()
		}
	}, [currentIdx, stories.length, onClose])

	const goToPrev = useCallback(() => {
		if (currentIdx > 0) {
			setProgress(0)
			elapsedBeforePause.current = 0
			setCurrentIdx((p) => p - 1)
		}
	}, [currentIdx])

	useEffect(() => {
		if (!isPaused) {
			startTimer()
		}
		return () => {
			if (timerRef.current) clearInterval(timerRef.current)
		}
	}, [currentIdx, isPaused, startTimer])

	// Pause/resume handlers
	const handleHoldStart = useCallback(() => {
		setIsPaused(true)
		if (timerRef.current) {
			clearInterval(timerRef.current)
			timerRef.current = null
			elapsedBeforePause.current += Date.now() - startTimeRef.current
		}
	}, [])

	const handleHoldEnd = useCallback(() => {
		setIsPaused(false)
	}, [])

	// Keyboard navigation
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft") goToPrev()
			if (e.key === "ArrowRight") goToNext()
			if (e.key === "Escape") onClose()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [goToNext, goToPrev, onClose])

	// Prevent body scroll
	useEffect(() => {
		document.body.style.overflow = "hidden"
		return () => {
			document.body.style.overflow = ""
		}
	}, [])

	if (!currentStory) return null

	const imgSrc = cfFullUrl(currentStory.imageId) || currentStory.imageUrl || ""

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
			{/* Image */}
			<div className="relative flex h-full w-full items-center justify-center">
				{imgSrc && (
					<img
						src={imgSrc}
						alt={currentStory.creatorName}
						className="max-h-full max-w-full object-contain"
						draggable={false}
					/>
				)}

				{/* Tap zones */}
				<button
					type="button"
					className="absolute inset-y-0 left-0 w-1/3 cursor-pointer"
					onClick={goToPrev}
					aria-label="Previous story"
				/>
				<button
					type="button"
					className="absolute inset-y-0 right-0 w-2/3 cursor-pointer"
					onClick={goToNext}
					onMouseDown={handleHoldStart}
					onMouseUp={handleHoldEnd}
					onMouseLeave={handleHoldEnd}
					onTouchStart={handleHoldStart}
					onTouchEnd={handleHoldEnd}
					aria-label="Next story"
				/>

				{/* Progress bar */}
				<div className="absolute inset-x-0 top-0 z-10 flex gap-1 px-2 pt-4">
					{Array.from({ length: PROGRESS_SEGMENTS }).map((_, i) => {
						const segmentProgress =
							progress > (i / PROGRESS_SEGMENTS) * 100
								? 100
								: progress > ((i - 1) / PROGRESS_SEGMENTS) * 100
									? (progress - ((i - 1) / PROGRESS_SEGMENTS) * 100) *
										PROGRESS_SEGMENTS
									: 0

						return (
							<div
								key={i}
								className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30"
							>
								<div
									className="h-full rounded-full bg-white transition-all duration-100 ease-linear"
									style={{ width: `${segmentProgress}%` }}
								/>
							</div>
						)
					})}
				</div>

				{/* Creator name */}
				<div className="absolute left-4 right-4 top-10 z-10">
					<p className="text-sm font-semibold text-white drop-shadow">
						{currentStory.creatorName}
					</p>
				</div>

				{/* Close button */}
				<button
					type="button"
					onClick={onClose}
					className="absolute right-3 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
					aria-label="Close story"
				>
					<X size={18} weight="bold" />
				</button>

				{/* Pause indicator */}
				{isPaused && (
					<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20">
						<div className="rounded-full bg-white/20 p-4 backdrop-blur">
							<div className="flex gap-1">
								<div className="h-8 w-2 rounded-sm bg-white" />
								<div className="h-8 w-2 rounded-sm bg-white" />
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
