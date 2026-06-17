import { useCallback, useEffect, useRef, useState } from "react"
import { X } from "@phosphor-icons/react"

interface MediaPreviewProps {
  url: string
  visible: boolean
  onClose: () => void
}

/**
 * Full-screen image overlay for chat attachments.
 * Pinch-to-zoom (two-finger distance tracking → CSS scale transform).
 * Swipe down to dismiss. Close X button top-right.
 */
export default function MediaPreview({ url, visible, onClose }: MediaPreviewProps) {
  const [scale, setScale] = useState(1)
  const [translateY, setTranslateY] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const distRef = useRef(0)
  const startYRef = useRef(0)
  const swipingRef = useRef(false)

  // Lock body scroll when visible
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [visible])

  // Touch pinch-to-zoom + swipe down to dismiss
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        distRef.current = Math.sqrt(dx * dx + dy * dy)
      }
      if (e.touches.length === 1) {
        startYRef.current = e.touches[0].clientY
        swipingRef.current = true
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      // Pinch-to-zoom
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const newDist = Math.sqrt(dx * dx + dy * dy)
        if (distRef.current > 0) {
          const ratio = newDist / distRef.current
          setScale((prev) => Math.max(0.5, Math.min(prev * ratio, 5)))
        }
        distRef.current = newDist
        return
      }

      // Swipe down
      if (e.touches.length === 1 && swipingRef.current) {
        const deltaY = e.touches[0].clientY - startYRef.current
        if (deltaY > 0 || scale <= 1) {
          setTranslateY(deltaY)
        }
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      // Reset pinch tracking
      if (e.touches.length < 2) distRef.current = 0

      // Dismiss on swipe down > 100px
      if (swipingRef.current) {
        const endY = e.changedTouches[0]?.clientY ?? startYRef.current
        const deltaY = endY - startYRef.current
        if (deltaY > 100) {
          onClose()
        }
        setTranslateY(0)
        swipingRef.current = false
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: true })
    el.addEventListener("touchend", onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
    }
  }, [scale, onClose])

  // Reset on open
  useEffect(() => {
    if (visible) {
      setScale(1)
      setTranslateY(0)
    }
  }, [visible])

  // Close on Escape key
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose],
  )

  if (!visible) return null

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 animate-fade-in"
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex size-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        aria-label="Close preview"
      >
        <X size={22} weight="bold" />
      </button>

      {/* Image */}
      <img
        src={url}
        alt="Media preview"
        className="object-contain max-h-full max-w-full select-none"
        style={{
          transform: `scale(${scale}) translateY(${translateY}px)`,
          transition: scale === 1 ? "transform 0.2s ease-out" : undefined,
        }}
        draggable={false}
      />

      {/* Hint text */}
      <span className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-white/50 pointer-events-none">
        Pinch to zoom &bull; Swipe down to close
      </span>
    </div>
  )
}
