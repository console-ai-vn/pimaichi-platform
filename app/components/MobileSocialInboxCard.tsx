// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { formatListDate } from "shared/dates";
import { useParams } from "react-router";
import MailboxAvatar from "~/components/MailboxAvatar";
import { getConversationPeer } from "~/lib/conversation-peer";
import { getAvatarVersion, useAvatarVersionMap } from "~/hooks/useAvatarVersions";
import { getSnippetText } from "~/lib/utils";
import type { Email } from "~/types";

function hasUnread(email: Email): boolean {
	if (email.thread_unread_count !== undefined) return email.thread_unread_count > 0;
	return !email.read;
}

interface MobileSocialInboxCardProps {
	email: Email;
	mailboxEmail?: string;
	isSelected: boolean;
	isPanelOpen: boolean;
	onOpen: (email: Email) => void;
	onToggleStar?: (event: React.MouseEvent, email: Email) => void;
	onToggleRead?: (event: React.MouseEvent, email: Email) => void;
	onDelete?: (event: React.MouseEvent, emailId: string) => void;
}

export default function MobileSocialInboxCard({
	email,
	mailboxEmail,
	isSelected,
	isPanelOpen,
	onOpen,
}: MobileSocialInboxCardProps) {
	const { folder } = useParams<{ folder: string }>();
	const avatarVersions = useAvatarVersionMap();
	const peer = getConversationPeer(email, mailboxEmail, folder);
	const snippet =
		getSnippetText(email.snippet, 120) ||
		getSnippetText(email.body, 120) ||
		"No messages yet";
	const unread = hasUnread(email);
	const threadCount = email.thread_count ?? 1;
	const avatarVersion = getAvatarVersion(avatarVersions, peer.email.trim().toLowerCase());

	return (
		<button
			type="button"
			onClick={() => onOpen(email)}
			className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
				isPanelOpen ? "md:px-3" : ""
			} ${
				isSelected
					? "bg-kumo-tint"
					: "hover:bg-kumo-tint/70"
			}`}
		>
			<MailboxAvatar
				email={peer.email}
				name={peer.name}
				size="lg"
				variant="brand"
				avatarVersion={avatarVersion}
			/>

			<div className="min-w-0 flex-1">
				<div className="flex items-baseline gap-2">
					<span
						className={`truncate text-[15px] ${
							unread ? "font-semibold text-kumo-default" : "font-medium text-kumo-strong"
						}`}
					>
						{peer.name}
					</span>
					<span className="ml-auto shrink-0 text-xs text-kumo-subtle">
						{formatListDate(email.date)}
					</span>
				</div>
				<div className="mt-0.5 flex items-center gap-2">
					<p
						className={`truncate text-sm ${
							unread ? "text-kumo-default" : "text-kumo-subtle"
						}`}
					>
						{snippet}
					</p>
					{threadCount > 1 && (
						<span className="shrink-0 rounded-full bg-kumo-fill px-1.5 py-0.5 text-[10px] font-medium text-kumo-subtle">
							{threadCount}
						</span>
					)}
					{unread && (
						<span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-kumo-brand" />
					)}
				</div>
			</div>
		</button>
	);
}