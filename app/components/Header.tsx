// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Input, Tooltip } from "@cloudflare/kumo";
import {
	ClipboardTextIcon,
	GlobeIcon,
	ListIcon,
	MagnifyingGlassIcon,
	MoonIcon,
	SunIcon,
	UserCircleIcon,
	XIcon,
} from "@phosphor-icons/react";
import { type KeyboardEvent, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { useThemeMode } from "~/hooks/useThemeMode";
import { useUIStore } from "~/hooks/useUIStore";
import api from "~/services/api";
import { queryKeys } from "~/queries/keys";

export default function Header() {
	const [searchQuery, setSearchQuery] = useState("");
	const [isSearchExpanded, setIsSearchExpanded] = useState(false);
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const { toggleSidebar } = useUIStore();
	const { mode, toggleMode } = useThemeMode();

	// Sync search input with URL query param so it stays populated
	const urlQuery = searchParams.get("q") || "";
	useEffect(() => {
		if (location.pathname.includes("/search") && urlQuery) {
			setSearchQuery(urlQuery);
		}
	}, [urlQuery, location.pathname]);

	const performSearch = () => {
		if (mailboxId && searchQuery.trim()) {
			const q = searchQuery.trim();
			navigate(`/mailbox/${mailboxId}/search?q=${encodeURIComponent(q)}`);
			setIsSearchExpanded(false);
		}
	};

	const clearSearch = () => {
		setSearchQuery("");
		if (location.pathname.includes("/search") && mailboxId) {
			navigate(`/mailbox/${mailboxId}/emails/inbox`);
		}
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter") {
			performSearch();
		}
		if (e.key === "Escape") {
			if (searchQuery) {
				clearSearch();
			} else {
				setIsSearchExpanded(false);
			}
		}
	};

	const { data: config } = useQuery({
		queryKey: queryKeys.config,
		queryFn: () => api.getConfig(),
	});
	const isSettingsActive = location.pathname.includes("/settings");
	const isAuditActive = location.pathname.includes("/audit");
	const isAdminDomainsActive = location.pathname.includes("/admin/domains");

	return (
		<header className="flex items-center gap-2 px-3 py-2.5 bg-kumo-base border-b border-kumo-line sticky top-0 z-10 md:px-5 md:gap-4">
			{/* Hamburger menu - mobile only */}
			<Button
				variant="ghost"
				shape="square"
				size="sm"
				icon={<ListIcon size={20} />}
				onClick={toggleSidebar}
				aria-label="Toggle sidebar"
				className="md:hidden shrink-0"
			/>

			{/* Search - full on desktop, collapsible on mobile */}
			<div
				className={`flex-1 max-w-lg transition-all flex items-center gap-1 ${
					isSearchExpanded ? "flex" : "hidden md:flex"
				}`}
			>
				<div className="flex-1 relative flex items-center">
					<Input
						className="w-full"
						aria-label="Search emails"
						placeholder="Search emails... (try from:name, is:unread, has:attachment)"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onKeyDown={handleKeyDown}
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={clearSearch}
							className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-kumo-subtle hover:text-kumo-default hover:bg-kumo-tint transition-colors"
							aria-label="Clear search"
						>
							<XIcon size={14} />
						</button>
					)}
				</div>
				<Tooltip content="Search" side="bottom" asChild>
					<Button
						variant="ghost"
						shape="square"
						icon={<MagnifyingGlassIcon size={20} />}
						onClick={performSearch}
						aria-label="Search"
					/>
				</Tooltip>
			</div>

			{/* Search toggle button - mobile only, hidden when search is expanded */}
			{!isSearchExpanded && (
				<Button
					variant="ghost"
					shape="square"
					size="sm"
					icon={<MagnifyingGlassIcon size={20} />}
					onClick={() => setIsSearchExpanded(true)}
					aria-label="Search"
					className="md:hidden shrink-0"
				/>
			)}

			<div className="flex items-center gap-1 ml-auto shrink-0">
				<Tooltip content={mode === "dark" ? "Light mode" : "Dark mode"} side="bottom" asChild>
					<Button
						variant="ghost"
						shape="square"
						icon={mode === "dark" ? <SunIcon size={20} /> : <MoonIcon size={20} />}
						onClick={toggleMode}
						aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
					/>
				</Tooltip>
				{config?.isAdmin && (
					<>
						<Tooltip content="Domain admin" side="bottom" asChild>
							<Button
								variant={isAdminDomainsActive ? "secondary" : "ghost"}
								shape="square"
								icon={<GlobeIcon size={20} />}
								onClick={() =>
									navigate(
										isAdminDomainsActive
											? `/mailbox/${mailboxId}/emails/inbox`
											: `/mailbox/${mailboxId}/admin/domains`,
									)
								}
								aria-label="Domain admin"
							/>
						</Tooltip>
						<Tooltip content="Audit log" side="bottom" asChild>
							<Button
								variant={isAuditActive ? "secondary" : "ghost"}
								shape="square"
								icon={<ClipboardTextIcon size={20} />}
								onClick={() =>
									navigate(
										isAuditActive
											? `/mailbox/${mailboxId}/emails/inbox`
											: `/mailbox/${mailboxId}/audit`,
									)
								}
								aria-label="Audit log"
							/>
						</Tooltip>
					</>
				)}
				<Tooltip content="Profile" side="bottom" asChild>
					<Button
						variant={isSettingsActive ? "secondary" : "ghost"}
						shape="square"
						icon={<UserCircleIcon size={20} />}
						onClick={() =>
							navigate(
								isSettingsActive
									? `/mailbox/${mailboxId}/emails/inbox`
									: `/mailbox/${mailboxId}/settings`,
							)
						}
						aria-label="Profile"
					/>
				</Tooltip>
			</div>
		</header>
	);
}
