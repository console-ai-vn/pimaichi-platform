import { Button } from "@cloudflare/kumo";
import {
	PaperPlaneTiltIcon,
	PencilSimpleIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import EmailAttachmentList from "~/components/EmailAttachmentList";
import MailboxAvatar from "~/components/MailboxAvatar";
import { getAvatarVersion } from "~/hooks/useAvatarVersions";
import { extractChatMessageText, formatShortDate } from "~/lib/utils";
import type { Email } from "~/types";

interface ChatBubbleProps {
	email: Email;
	mailboxId?: string;
	mailboxEmail?: string;
	isDraft?: boolean;
	isSending?: boolean;
	avatarVersions?: Map<string, string>;
	onSendDraft?: () => void;
	onEditDraft?: () => void;
	onDeleteDraft?: () => void;
	onPreviewImage?: (url: string, filename: string) => void;
}

export default function ChatBubble({
	email,
	mailboxId,
	mailboxEmail,
	isDraft,
	isSending,
	avatarVersions,
	onSendDraft,
	onEditDraft,
	onDeleteDraft,
	onPreviewImage,
}: ChatBubbleProps) {
	const senderEmail = email.sender.trim().toLowerCase();
	const isSelf = senderEmail === mailboxEmail?.trim().toLowerCase();
	const avatarVersion = getAvatarVersion(avatarVersions ?? new Map(), senderEmail);
	const bodyText = extractChatMessageText(email.body) || "(empty message)";

	return (
		<div
			className={`flex items-end gap-2 px-4 ${isSelf ? "flex-row-reverse" : "flex-row"}`}
		>
			{!isSelf && (
				<MailboxAvatar
					email={senderEmail}
					name={email.sender}
					size="sm"
					variant="muted"
					avatarVersion={avatarVersion}
					className="mb-1 shrink-0"
				/>
			)}
			<div
				className={`max-w-[min(85%,28rem)] ${isSelf ? "items-end" : "items-start"} flex flex-col gap-1`}
			>
				<div
					className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
						isDraft
							? "border border-dashed border-kumo-warning bg-kumo-warning/5 text-kumo-default"
							: isSelf
								? "rounded-br-md bg-kumo-brand text-white"
								: "rounded-bl-md border border-kumo-line bg-kumo-base text-kumo-default"
					}`}
				>
					<p className="whitespace-pre-wrap break-words">{bodyText}</p>
				</div>
				<span className="px-1 text-[11px] text-kumo-subtle">
					{isSelf ? "You" : email.sender.split("@")[0]} · {formatShortDate(email.date)}
					{isDraft ? " · Draft" : ""}
				</span>
				{mailboxId && email.attachments && email.attachments.length > 0 && (
					<EmailAttachmentList
						mailboxId={mailboxId}
						emailId={email.id}
						attachments={email.attachments}
						onPreviewImage={onPreviewImage}
						className="max-w-full"
					/>
				)}
				{isDraft && (onSendDraft || onEditDraft || onDeleteDraft) && (
					<div className="flex flex-wrap gap-1.5 pt-0.5">
						{onSendDraft && (
							<Button
								variant="primary"
								size="sm"
								icon={<PaperPlaneTiltIcon size={14} />}
								onClick={onSendDraft}
								loading={isSending}
								disabled={isSending}
							>
								Send
							</Button>
						)}
						{onEditDraft && (
							<Button
								variant="secondary"
								size="sm"
								icon={<PencilSimpleIcon size={14} />}
								onClick={onEditDraft}
								disabled={isSending}
							>
								Edit
							</Button>
						)}
						{onDeleteDraft && (
							<Button
								variant="ghost"
								size="sm"
								icon={<TrashIcon size={14} />}
								onClick={onDeleteDraft}
								disabled={isSending}
							>
								Discard
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}