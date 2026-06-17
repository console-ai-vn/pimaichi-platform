import { useState } from "react"
import { Button } from "@cloudflare/kumo"
import {
  UserCircle,
  GearIcon,
  CurrencyCircleDollarIcon,
  SignOutIcon,
  UsersIcon,
  ToggleRightIcon,
  ToggleLeftIcon,
} from "@phosphor-icons/react"
import EarningsDashboard from "~/components/EarningsDashboard"
import { useEarnings } from "~/hooks/useEarnings"

export function meta() {
  return [{ title: "Profile — ONYX" }]
}

export default function ProfileTab() {
  const [isCreatorMode, setIsCreatorMode] = useState(false)
  const [showWithdrawToast, setShowWithdrawToast] = useState(false)

  // In a real app, the creatorId would come from the logged-in user's mailbox
  const creatorId = "me"

  const { data: earnings } = useEarnings(creatorId)

  const handleWithdraw = () => {
    setShowWithdrawToast(true)
    setTimeout(() => setShowWithdrawToast(false), 5000)
  }

  const handleLogout = () => {
    // Redirect to logout or clear session
    window.location.href = "/"
  }

  return (
    <div className="px-4 py-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="size-16 overflow-hidden rounded-full bg-kumo-brand/10 ring-2 ring-kumo-line flex items-center justify-center">
          <UserCircle size={40} className="text-kumo-brand" weight="duotone" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-kumo-default truncate">
            Your Profile
          </h1>
          <p className="text-sm text-kumo-subtle">user@onyx.com.vn</p>
        </div>
      </div>

      {/* Creator Mode Toggle */}
      <div className="rounded-2xl border border-kumo-line bg-kumo-base mb-4">
        <button
          type="button"
          onClick={() => setIsCreatorMode(!isCreatorMode)}
          className="flex w-full items-center justify-between p-4 hover:bg-kumo-recessed transition-colors rounded-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-kumo-brand/10">
              <CurrencyCircleDollarIcon
                size={22}
                className="text-kumo-brand"
                weight="fill"
              />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-kumo-default">
                Creator Mode
              </p>
              <p className="text-xs text-kumo-subtle">
                {isCreatorMode
                  ? "Showing earnings & analytics"
                  : "Enable to view your earnings"}
              </p>
            </div>
          </div>
          {isCreatorMode ? (
            <ToggleRightIcon size={28} className="text-kumo-brand" weight="fill" />
          ) : (
            <ToggleLeftIcon size={28} className="text-kumo-inactive" />
          )}
        </button>
      </div>

      {/* Earnings Dashboard (creator mode only) */}
      {isCreatorMode && earnings && (
        <div className="mb-6">
          <EarningsDashboard
            total={earnings.total}
            lastMonth={earnings.lastMonth}
            change={earnings.change}
            daily={earnings.daily}
            transactions={earnings.transactions}
            onWithdraw={handleWithdraw}
          />
        </div>
      )}

      {/* Withdraw toast */}
      {showWithdrawToast && (
        <div className="mb-4 rounded-xl border border-kumo-line bg-kumo-base p-4 animate-slide-up">
          <p className="text-sm font-medium text-kumo-default">
            Withdrawal Requested
          </p>
          <p className="text-xs text-kumo-subtle mt-1">
            Processing (2–5 business days). Funds will be transferred to your
            registered bank account.
          </p>
        </div>
      )}

      {/* Subscribed Creators */}
      <div className="rounded-2xl border border-kumo-line bg-kumo-base mb-4">
        <button
          type="button"
          className="flex w-full items-center justify-between p-4 hover:bg-kumo-recessed transition-colors rounded-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20">
              <UsersIcon size={22} className="text-blue-500" weight="fill" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-kumo-default">
                Subscriptions
              </p>
              <p className="text-xs text-kumo-subtle">
                Manage your subscribed creators
              </p>
            </div>
          </div>
          <span className="text-xs text-kumo-subtle">3 active</span>
        </button>
      </div>

      {/* Settings */}
      <div className="rounded-2xl border border-kumo-line bg-kumo-base mb-4">
        <button
          type="button"
          onClick={() => (window.location.href = "/settings")}
          className="flex w-full items-center gap-3 p-4 hover:bg-kumo-recessed transition-colors rounded-2xl"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-kumo-fill">
            <GearIcon size={22} className="text-kumo-subtle" weight="fill" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-kumo-default">Settings</p>
            <p className="text-xs text-kumo-subtle">
              Account, notifications, privacy
            </p>
          </div>
        </button>
      </div>

      {/* Logout */}
      <Button
        variant="secondary"
        size="base"
        className="w-full mt-2"
        onClick={handleLogout}
      >
        <SignOutIcon size={18} className="mr-2" />
        Logout
      </Button>
    </div>
  )
}
