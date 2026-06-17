import { useCallback, useRef, useState } from "react"
import { ImageIcon, LockKey, LockIcon } from "@phosphor-icons/react"
import { cfThumbUrl, cfBlurUrl } from "~/lib/cf-images"
import type { ContentTier } from "~/components/ContentTierBadge"
import PaywallSheet from "~/components/PaywallSheet"
import ThankYouAnimation from "~/components/ThankYouAnimation"
import { usePaywall } from "~/hooks/usePaywall"

export interface ContentCardItem {
  id: string
  thumbnailUrl?: string | null
  imageId?: string | null
  title: string
  tier: ContentTier
  isUnlocked: boolean
  creatorName?: string
  mailboxId?: string
  emailId?: string
}

interface ContentCardProps {
  item: ContentCardItem
  onClick?: (item: ContentCardItem) => void
  onDoubleTap?: (item: ContentCardItem) => void
  onLongPress?: (item: ContentCardItem) => void
}

/**
 * Content card with double-tap and long-press gesture support.
 * Blur + lock overlay for gated content. PaywallSheet on tap for gated content.
 */
export default function ContentCard({
  item,
  onClick,
  onDoubleTap,
  onLongPress,
}: ContentCardProps) {
  const imgSrc = cfThumbUrl(item.imageId) || item.thumbnailUrl || ""
  const blurSrc = cfBlurUrl(item.imageId)
  const isGated = !item.isUnlocked && item.tier !== "public"
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartTime = useRef(0)
  const longPressTriggered = useRef(false)

  const [showPaywall, setShowPaywall] = useState(false)
  const [showThankYou, setShowThankYou] = useState(false)

  // Paywall logic
  const paywall = usePaywall(
    item.mailboxId || "",
    item.emailId || "",
  )

  const handleShowPaywall = useCallback(() => {
    if (isGated && item.mailboxId && item.emailId) {
      paywall.checkGate()
      setShowPaywall(true)
    } else if (isGated) {
      // No mailbox/email context — still show paywall as fallback
      setShowPaywall(true)
    }
  }, [isGated, item.mailboxId, item.emailId, paywall])

  const handleSubscribe = useCallback(() => {
    // Navigate to checkout/pricing
    window.location.href = "/pricing"
  }, [])

  const handleUnlock = useCallback(async () => {
    if (item.emailId && item.mailboxId) {
      const success = await paywall.unlock(item.id)
      if (success) {
        setShowPaywall(false)
        setShowThankYou(true)
        setTimeout(() => setShowThankYou(false), 2200)
      }
    } else {
      setShowPaywall(false)
      setShowThankYou(true)
      setTimeout(() => setShowThankYou(false), 2200)
    }
  }, [paywall, item])

  // Double-tap detection (<300ms between taps)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      touchStartTime.current = Date.now()
      longPressTriggered.current = false

      // Long-press timer (500ms)
      longPressTimerRef.current = setTimeout(() => {
        longPressTriggered.current = true
        onLongPress?.(item)
      }, 500)
    },
    [item, onLongPress],
  )

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }

      if (longPressTriggered.current) return

      const elapsed = Date.now() - touchStartTime.current

      if (elapsed < 300) {
        tapCountRef.current += 1

        if (tapCountRef.current === 1) {
          tapTimerRef.current = setTimeout(() => {
            // Single tap
            if (isGated) {
              handleShowPaywall()
            } else {
              onClick?.(item)
            }
            tapCountRef.current = 0
          }, 300)
        } else if (tapCountRef.current >= 2) {
          // Double tap
          if (tapTimerRef.current) {
            clearTimeout(tapTimerRef.current)
            tapTimerRef.current = null
          }
          onDoubleTap?.(item)
          tapCountRef.current = 0
        }
      } else {
        if (isGated) {
          handleShowPaywall()
        } else {
          onClick?.(item)
        }
        tapCountRef.current = 0
      }
    },
    [item, onClick, onDoubleTap, isGated, handleShowPaywall],
  )

  const handleTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressTriggered.current = true
  }, [])

  return (
    <>
      <button
        type="button"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onClick={() => {
          if (isGated) {
            handleShowPaywall()
          } else {
            onClick?.(item)
          }
        }}
        className="group relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-kumo-line bg-kumo-fill text-left focus:outline-none focus:ring-2 focus:ring-kumo-brand"
      >
        {/* Image */}
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
              loading="lazy"
              decoding="async"
              className={`relative z-10 h-full w-full object-cover transition-transform group-hover:scale-105 ${
                isGated ? "blur-lg" : ""
              }`}
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-kumo-fill">
            <ImageIcon size={32} className="text-kumo-inactive" weight="duotone" />
          </div>
        )}

        {/* Dim overlay for gated */}
        {isGated && (
          <div className="absolute inset-0 z-10 bg-black/40" />
        )}

        {/* Lock badge */}
        {isGated && (
          <div className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur">
            {item.tier === "ppv" ? (
              <LockKey size={12} className="text-amber-400" weight="fill" />
            ) : (
              <LockIcon size={12} className="text-blue-400" weight="fill" />
            )}
            <span className="text-[10px] font-medium text-white">
              {item.tier === "ppv" ? "PPV" : "SUB"}
            </span>
          </div>
        )}

        {/* Title + creator overlay */}
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent p-2">
          {item.creatorName && (
            <p className="text-[10px] font-medium text-white/80">
              {item.creatorName}
            </p>
          )}
          <p className="truncate text-xs font-medium text-white">
            {item.title}
          </p>
        </div>
      </button>

      {/* Paywall Sheet */}
      <PaywallSheet
        visible={showPaywall}
        creator={{
          name: item.creatorName || "Creator",
          avatarUrl: null,
        }}
        contentTier={item.tier}
        keyPrice={paywall.keyPrice}
        previewImage={
          imgSrc && isGated ? imgSrc : undefined
        }
        previewText={
          !imgSrc && isGated ? item.title : undefined
        }
        onClose={() => setShowPaywall(false)}
        onSubscribe={handleSubscribe}
        onUnlock={handleUnlock}
      />

      {/* Thank You Animation */}
      <ThankYouAnimation
        visible={showThankYou}
        onComplete={() => setShowThankYou(false)}
      />
    </>
  )
}
