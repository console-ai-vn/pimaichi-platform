import { useEffect, useState } from "react"
import { TimerIcon } from "@phosphor-icons/react"

interface CountdownTimerProps {
  endTime: string // ISO date string
  message?: string
}

function calcRemaining(endTime: string) {
  const diff = new Date(endTime).getTime() - Date.now()
  if (diff <= 0) return { expired: true, hours: 0, minutes: 0, seconds: 0 }
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  return { expired: false, hours, minutes, seconds }
}

export default function CountdownTimer({
  endTime,
  message,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => calcRemaining(endTime))

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(calcRemaining(endTime))
    }, 1000)
    return () => clearInterval(interval)
  }, [endTime])

  if (remaining.expired) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-kumo-fill px-3 py-1 text-xs text-kumo-inactive">
        <TimerIcon size={14} />
        <span>Offer ended</span>
      </div>
    )
  }

  const pad = (n: number) => n.toString().padStart(2, "0")

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-red-100/80 dark:bg-red-900/30 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300">
      <TimerIcon size={14} weight="fill" />
      <span>
        {message && <span className="mr-1">{message}</span>}
        <span className="tabular-nums font-mono font-bold">
          {remaining.hours > 0 ? `${remaining.hours}h ` : ""}
          {pad(remaining.minutes)}m {pad(remaining.seconds)}s
        </span>
        <span className="ml-0.5">left</span>
      </span>
    </div>
  )
}
