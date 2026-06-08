import { Button } from "@cloudflare/kumo";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router";
import ChatBubble from "~/components/chat/ChatBubble";
import ChatComposer from "~/components/chat/ChatComposer";
import ConversationHeaderActions from "~/components/ConversationHeaderActions";
import EmailPanelDialogs from "~/components/email-panel/EmailPanelDialogs";
import MailboxAvatar from "~/components/MailboxAvatar";
import { getAvatarVersion, useAvatarVersionMap } from "~/hooks/useAvatarVersions";
import { getConversationPeer } from "~/lib/conversation-peer";
import { useUIStore } from "~/hooks/useUIStore";
import type { Email } from "~/types";

interface ChatConversationViewProps {
	email: Email;
	mailboxEmail?: string;
	allMessages: Email[];
	draftMessageIds: Set<string>;
	isSending: boolean;
	onSendDraft: (draft?: Email) => void;
	onEditDraft: (draft?: Email) => void;
	onDeleteDraft: (draft?: Email) => void;
	sourceViewEmail: Email | null;
	onCloseSource: () => void;
	previewImage: { url: string; filename: string } | null;
	onPreviewImage: (url: string, filename: string) => void;
	onClosePreview: () => void;
}

export default function ChatConversationView({
	email,
	mailboxEmail,
	allMessages,
	draftMessageIds,
	isSending,
	onSendDraft,
	onEditDraft,
	onDeleteDraft,
	sourceViewEmail,
	onCloseSource,
	previewImage,
	onPreviewImage,
	onClosePreview,
}: ChatConversationViewProps) {
	const { mailboxId, folder } = useParams<{ mailboxId: string; folder: string }>();
	const { closePanel } = useUIStore();
	const avatarVersions = useAvatarVersionMap();
	const bottomRef = useRef<HTMLDivElement>(null);

	const peer = useMemo(
		() => getConversationPeer(email, mailboxEmail, folder),
		[email, mailboxEmail, folder],
	);
	const peerAvatarVersion = getAvatarVersion(
		avatarVersions,
		peer.email.trim().toLowerCase(),
	);

	const chatMessages = useMemo(
		() =>
			[...allMessages].sort(
				(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
			),
		[allMessages],
	);

	const replyTarget = useMemo(() => {
		const active = chatMessages.filter((msg) => !draftMessageIds.has(msg.id));
		return active[active.length - 1] ?? email;
	}, [chatMessages, draftMessageIds, email]);

	const scrollToBottom = () => {
		bottomRef.current?.scrollIntoView({ block: "end" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [email.id, chatMessages.length]);

	return (
		<div className="relative flex h-full flex-col bg-kumo-recessed">
			<div className="flex shrink-0 items-center gap-3 border-b border-kumo-line bg-kumo-base px-3 py-3 md:px-4">
				<Button
					variant="ghost"
					shape="square"
					size="sm"
					icon={<ArrowLeftIcon size={18} />}
					onClick={closePanel}
					aria-label="Back to conversations"
					className="md:hidden shrink-0"
				/>
				<MailboxAvatar
					email={peer.email}
					name={peer.name}
					size="md"
					variant="brand"
					avatarVersion={peerAvatarVersion}
				/>
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-base font-semibold text-kumo-default">
						{peer.name}
					</h2>
					<p className="truncate text-xs text-kumo-subtle">{peer.email}</p>
				</div>
				<ConversationHeaderActions email={email} />
			</div>

			<div className="flex-1 space-y-3 overflow-y-auto py-4">
				{chatMessages.map((msg) => {
					const isDraft = draftMessageIds.has(msg.id);
					return (
						<ChatBubble
							key={msg.id}
							email={msg}
							mailboxId={mailboxId}
							mailboxEmail={mailboxEmail}
							isDraft={isDraft}
							isSending={isDraft ? isSending : false}
							avatarVersions={avatarVersions}
							onSendDraft={isDraft ? () => onSendDraft(msg) : undefined}
							onEditDraft={isDraft ? () => onEditDraft(msg) : undefined}
							onDeleteDraft={isDraft ? () => onDeleteDraft(msg) : undefined}
							onPreviewImage={onPreviewImage}
						/>
					);
				})}
				<div ref={bottomRef} />
			</div>

			{mailboxId && (
				<ChatComposer
					mailboxId={mailboxId}
					peerEmail={peer.email}
					replyTarget={replyTarget}
					onSent={scrollToBottom}
				/>
			)}

			<EmailPanelDialogs
				sourceViewEmail={sourceViewEmail}
				previewImage={previewImage}
				onCloseSource={onCloseSource}
				onClosePreview={onClosePreview}
			/>
		</div>
	);
}