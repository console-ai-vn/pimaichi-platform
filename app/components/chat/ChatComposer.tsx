import { Button, useKumoToastManager } from "@cloudflare/kumo";
import { ImageIcon, PaperPlaneTiltIcon, XIcon } from "@phosphor-icons/react";
import { type KeyboardEvent, useRef, useState } from "react";
import {
	filesToImageAttachments,
	type OutgoingImageAttachment,
} from "~/lib/image-attachments";
import { escapeHtml } from "~/lib/utils";
import { useReplyToEmail } from "~/queries/emails";
import { useMailbox } from "~/queries/mailboxes";
import type { Email } from "~/types";

interface ChatComposerProps {
	mailboxId: string;
	peerEmail: string;
	replyTarget: Email;
	onSent?: () => void;
}

function replySubject(subject?: string | null): string {
	const value = subject?.trim() || "(no subject)";
	return value.startsWith("Re: ") ? value : `Re: ${value}`;
}

export default function ChatComposer({
	mailboxId,
	peerEmail,
	replyTarget,
	onSent,
}: ChatComposerProps) {
	const toastManager = useKumoToastManager();
	const { data: mailbox } = useMailbox(mailboxId);
	const replyMutation = useReplyToEmail();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [message, setMessage] = useState("");
	const [attachments, setAttachments] = useState<OutgoingImageAttachment[]>([]);
	const [error, setError] = useState<string | null>(null);

	const isSending = replyMutation.isPending;
	const canSend =
		!isSending && (message.trim().length > 0 || attachments.length > 0);

	const addImages = async (files: File[]) => {
		if (files.length === 0) return;
		try {
			const next = await filesToImageAttachments(files, attachments);
			setAttachments((current) => [...current, ...next]);
			setError(null);
		} catch (err: unknown) {
			const text =
				(err instanceof Error ? err.message : null) || "Could not attach image.";
			setError(text);
			toastManager.add({ title: text, variant: "error" });
		}
	};

	const removeAttachment = (index: number) => {
		setAttachments((current) => current.filter((_, i) => i !== index));
	};

	const handleSend = async () => {
		if (!canSend || !mailbox) return;
		setError(null);
		const text = message.trim();
		const html = text
			? `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`
			: "<p></p>";
		const fromName = mailbox.settings?.fromName || mailbox.name;
		const from =
			fromName && fromName !== mailbox.email
				? { email: mailbox.email, name: fromName }
				: mailbox.email;

		try {
			await replyMutation.mutateAsync({
				mailboxId,
				emailId: replyTarget.id,
				email: {
					to: peerEmail,
					from,
					subject: replySubject(replyTarget.subject),
					html,
					text: text || undefined,
					attachments: attachments.length > 0 ? attachments : undefined,
				},
			});
			setMessage("");
			setAttachments([]);
			onSent?.();
		} catch (err: unknown) {
			const text =
				(err instanceof Error ? err.message : null) || "Failed to send message.";
			setError(text);
			toastManager.add({ title: text, variant: "error" });
		}
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			void handleSend();
		}
	};

	return (
		<div className="shrink-0 border-t border-kumo-line bg-kumo-base px-3 py-2.5 md:px-4">
			{error && (
				<p className="mb-2 text-xs text-kumo-warning">{error}</p>
			)}
			{attachments.length > 0 && (
				<div className="mb-2 flex gap-2 overflow-x-auto pb-1">
					{attachments.map((file, index) => (
						<div
							key={`${file.filename}-${index}`}
							className="flex shrink-0 items-center gap-1.5 rounded-full border border-kumo-line bg-kumo-recessed px-2.5 py-1 text-xs text-kumo-subtle"
						>
							<ImageIcon size={14} />
							<span className="max-w-[8rem] truncate">{file.filename}</span>
							<button
								type="button"
								onClick={() => removeAttachment(index)}
								className="text-kumo-subtle hover:text-kumo-default"
								aria-label={`Remove ${file.filename}`}
							>
								<XIcon size={12} />
							</button>
						</div>
					))}
				</div>
			)}
			<div className="flex items-end gap-2">
				<input
					ref={fileInputRef}
					type="file"
					accept="image/jpeg,image/png,image/webp"
					multiple
					className="hidden"
					onChange={(event) => {
						void addImages(Array.from(event.target.files || []));
						event.target.value = "";
					}}
				/>
				<Button
					variant="ghost"
					shape="square"
					size="sm"
					icon={<ImageIcon size={20} />}
					onClick={() => fileInputRef.current?.click()}
					disabled={isSending}
					aria-label="Attach image"
					className="shrink-0 mb-0.5"
				/>
				<textarea
					value={message}
					onChange={(event) => setMessage(event.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Nhập tin nhắn..."
					rows={1}
					disabled={isSending}
					className="min-h-[42px] max-h-32 flex-1 resize-none rounded-3xl border border-kumo-line bg-kumo-recessed px-4 py-2.5 text-sm text-kumo-default outline-none transition-colors placeholder:text-kumo-subtle focus:border-kumo-brand"
				/>
				<Button
					variant="primary"
					shape="square"
					size="sm"
					icon={<PaperPlaneTiltIcon size={18} weight="fill" />}
					onClick={() => void handleSend()}
					loading={isSending}
					disabled={!canSend}
					aria-label="Send message"
					className="shrink-0 mb-0.5"
				/>
			</div>
		</div>
	);
}