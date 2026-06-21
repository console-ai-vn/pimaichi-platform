import {
  Envelope,
  House,
  MagnifyingGlass,
  PlusCircle,
  UserCircle,
} from "@phosphor-icons/react"
import { useState } from "react"
import { NavLink } from "react-router"

const NAV_ITEMS = [
  { id: "feed", icon: House, label: "Feed", path: "/app" },
  { id: "explore", icon: MagnifyingGlass, label: "Explore", path: "/app/explore" },
  { id: "create", icon: PlusCircle, label: "Create", path: "/app/create" },
  { id: "dm", icon: Envelope, label: "DM", path: "/app/dm" },
  { id: "profile", icon: UserCircle, label: "Profile", path: "/app/profile" },
] as const

interface DesktopSidebarProps {
  /** DM unread count for the badge */
  badgeCount?: number
  /** Current user display info — passed down or fetched inside */
  user?: {
    name: string
    username: string
    avatarUrl?: string
  }
}

export default function DesktopSidebar({ badgeCount = 0, user }: DesktopSidebarProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <aside
      className="hidden md:flex md:flex-col fixed left-0 top-0 bottom-0 z-40 border-r border-kumo-line bg-kumo-base transition-all duration-200 ease-out"
      style={{ width: expanded ? 240 : 64 }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-kumo-line px-4">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-kumo-brand text-xs font-bold text-white">
          P
        </div>
        <span
          className={`ml-3 overflow-hidden whitespace-nowrap text-sm font-semibold text-kumo-default transition-opacity duration-200 ${
            expanded ? "opacity-100" : "opacity-0"
          }`}
        >
          Pimaichi
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.id === "feed"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-kumo-brand/10 font-semibold text-kumo-brand"
                  : "text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={20}
                  weight={isActive ? "fill" : "regular"}
                  className="shrink-0"
                />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-opacity duration-200 ${
                    expanded ? "opacity-100" : "opacity-0 w-0"
                  }`}
                >
                  {item.label}
                </span>
                {item.id === "dm" && badgeCount > 0 && (
                  <span className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Account info at bottom */}
      {user && (
        <div className="border-t border-kumo-line p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kumo-brand/10 text-xs font-bold text-kumo-brand">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div
              className={`flex-1 overflow-hidden transition-opacity duration-200 ${
                expanded ? "opacity-100" : "opacity-0 w-0"
              }`}
            >
              <div className="truncate text-sm font-medium text-kumo-default">
                {user.name}
              </div>
              <div className="truncate text-xs text-kumo-subtle">
                @{user.username}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
