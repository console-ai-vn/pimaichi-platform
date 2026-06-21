// DM conversation card — repurposed from email inbox for creator DMs

import { formatListDate } from "shared/dates";

interface DMConversation {
	id: string;
	participantName: string;
	participantUsername: string;
	lastMessage: string;
	lastMessageDate: string;
	unreadCount: number;
	avatarUrl?: string | null;
}

interface DMConversationCardProps {
	conversation: DMConversation;
	isSelected: boolean;
	isPanelOpen: boolean;
	onOpen: (conversation: DMConversation) => void;
}

export default function DMConversationCard({
	conversation,
	isSelected,
	isPanelOpen,
	onOpen,
}: DMConversationCardProps) {
	const unread = conversation.unreadCount > 0;

	return (
		<button
			type="button"
			onClick={() => onOpen(conversation)}
			className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
				isPanelOpen ? "md:px-3" : ""
			} ${
				isSelected
					? "bg-kumo-tint"
					: "hover:bg-kumo-tint/70"
			}`}
		>
			<div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-kumo-brand/10 text-sm font-bold text-kumo-brand ring-1 ring-kumo-line">
				{conversation.avatarUrl ? (
					<img
						src={conversation.avatarUrl}
						alt={conversation.participantName}
						className="h-full w-full object-cover"
					/>
				) : (
					conversation.participantName[0]?.toUpperCase() || "?"
				)}
			</div>

			<div className="min-w-0 flex-1">
				<div className="flex items-baseline gap-2">
					<span
						className={`truncate text-[15px] ${
							unread ? "font-semibold text-kumo-default" : "font-medium text-kumo-strong"
						}`}
					>
						{conversation.participantName}
					</span>
					<span className="ml-auto shrink-0 text-xs text-kumo-subtle">
						{formatListDate(conversation.lastMessageDate)}
					</span>
				</div>
				<div className="mt-0.5 flex items-center gap-2">
					<p
						className={`truncate text-sm ${
							unread ? "text-kumo-default" : "text-kumo-subtle"
						}`}
					>
						{conversation.lastMessage}
					</p>
					{unread && (
						<span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-kumo-brand px-1 text-[10px] font-bold text-white">
							{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
						</span>
					)}
				</div>
			</div>
		</button>
	);
}