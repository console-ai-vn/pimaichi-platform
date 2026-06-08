// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useEffect, useRef, useMemo, useState } from "react";
import { Outlet, useParams } from "react-router";
import ComposeEmail from "~/components/ComposeEmail";
import ConversationOverlays from "~/components/ConversationOverlays";
import Header from "~/components/Header";
import Sidebar from "~/components/Sidebar";
import { ConversationActionsContext } from "~/hooks/useConversationActions";
import { useMailbox } from "~/queries/mailboxes";
import { useUIStore } from "~/hooks/useUIStore";
import type { Email } from "~/types";

export default function MailboxRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	// Prefetch mailbox data for child components
	useMailbox(mailboxId);
	const prevMailboxIdRef = useRef<string | undefined>(undefined);
	const [sourceViewEmail, setSourceViewEmail] = useState<Email | null>(null);
	const conversationActions = useMemo(
		() => ({ onViewSource: setSourceViewEmail }),
		[],
	);
	const {
		isSidebarOpen,
		closeSidebar,
		closePanel,
		closeComposeModal,
	} = useUIStore();

	useEffect(() => {
		if (
			prevMailboxIdRef.current &&
			mailboxId &&
			prevMailboxIdRef.current !== mailboxId
		) {
			closePanel();
			closeComposeModal();
			closeSidebar();
		}

		prevMailboxIdRef.current = mailboxId;
	}, [mailboxId, closeComposeModal, closePanel, closeSidebar]);

	return (
		<ConversationActionsContext.Provider value={conversationActions}>
		<div className="flex h-screen overflow-hidden relative">
			{/* Mobile sidebar overlay backdrop */}
			{isSidebarOpen && (
				<div
					className="fixed inset-0 z-30 bg-black/30 md:hidden"
					onClick={closeSidebar}
					onKeyDown={(e) => e.key === "Escape" && closeSidebar()}
					role="button"
					tabIndex={-1}
					aria-label="Close sidebar"
				/>
			)}

			{/* Sidebar: hidden on mobile by default, shown as overlay when open */}
			<div
				className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 md:z-0 ${
					isSidebarOpen ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				<Sidebar />
			</div>

			{/* Main content */}
			<div className="flex-1 flex flex-col min-w-0 bg-kumo-base">
				<Header />
				<main className="flex-1 overflow-hidden">
					<Outlet />
				</main>
			</div>

			<ComposeEmail />
			<ConversationOverlays
				sourceViewEmail={sourceViewEmail}
				onCloseSource={() => setSourceViewEmail(null)}
			/>
		</div>
		</ConversationActionsContext.Provider>
	);
}
