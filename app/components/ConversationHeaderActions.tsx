import { Button, Tooltip, useKumoToastManager } from "@cloudflare/kumo";
import {
	ProhibitIcon,
	RobotIcon,
	SparkleIcon,
	StarIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { useMemo } from "react";
import { useParams } from "react-router";
import { Folders } from "shared/folders";
import { getConversationPeer } from "~/lib/conversation-peer";
import {
	useContactProfile,
	useMoveThread,
	useUpdateContactProfile,
	useUpdateEmail,
} from "~/queries/emails";
import { useMailbox } from "~/queries/mailboxes";
import { useUIStore } from "~/hooks/useUIStore";
import type { Email } from "~/types";

interface ConversationHeaderActionsProps {
	email: Email;
}

export default function ConversationHeaderActions({
	email,
}: ConversationHeaderActionsProps) {
	const { mailboxId, folder } = useParams<{ mailboxId: string; folder: string }>();
	const {
		closePanel,
		openAgentPanel,
		isAgentPanelOpen,
		toggleSocialContext,
		isSocialContextOpen,
	} = useUIStore();
	const updateEmail = useUpdateEmail();
	const moveThread = useMoveThread();
	const updateContactProfile = useUpdateContactProfile();
	const { data: currentMailbox } = useMailbox(mailboxId);
	const toastManager = useKumoToastManager();

	const peer = useMemo(
		() => getConversationPeer(email, currentMailbox?.email, folder),
		[email, currentMailbox?.email, folder],
	);
	const peerEmail = peer.email.trim().toLowerCase();
	const { data: contactProfile } = useContactProfile(mailboxId, peerEmail);
	const isBlocked = contactProfile?.blocked === true;

	const handleToggleStar = () => {
		if (!mailboxId) return;
		updateEmail.mutate({
			mailboxId,
			id: email.id,
			data: { starred: !email.starred },
		});
	};

	const handleMoveToTrash = async () => {
		if (!mailboxId) return;
		if (!window.confirm("Move this conversation to Trash?")) return;
		const threadId = email.thread_id ?? email.id;
		try {
			await moveThread.mutateAsync({
				mailboxId,
				threadId,
				folderId: Folders.TRASH,
			});
			closePanel();
			toastManager.add({ title: "Moved to Trash" });
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Could not move to Trash";
			toastManager.add({ title: message, variant: "error" });
		}
	};

	const handleToggleBlock = async () => {
		if (!mailboxId || !peerEmail) return;
		if (!isBlocked) {
			const confirmed = window.confirm(
				`Block ${peer.name}? They won't be able to message you anymore.`,
			);
			if (!confirmed) return;
		}
		await updateContactProfile.mutateAsync({
			mailboxId,
			emailAddress: peerEmail,
			profile: { blocked: !isBlocked },
		});
		toastManager.add({
			title: isBlocked ? `${peer.name} unblocked` : `${peer.name} blocked`,
		});
	};

	return (
		<div className="flex shrink-0 items-center gap-0.5">
			<Tooltip content="AI agent" side="bottom" asChild>
				<Button
					variant={isAgentPanelOpen ? "secondary" : "ghost"}
					size="sm"
					icon={<RobotIcon size={16} />}
					onClick={openAgentPanel}
					aria-label="Open AI agent"
					className="hidden sm:inline-flex"
				>
					AI
				</Button>
			</Tooltip>
			<Tooltip content="AI agent" side="bottom" asChild>
				<Button
					variant={isAgentPanelOpen ? "secondary" : "ghost"}
					shape="square"
					size="sm"
					icon={<RobotIcon size={18} />}
					onClick={openAgentPanel}
					aria-label="Open AI agent"
					className="sm:hidden"
				/>
			</Tooltip>

			<Tooltip content={email.starred ? "Unstar" : "Star"} side="bottom" asChild>
				<Button
					variant="ghost"
					shape="square"
					size="sm"
					icon={
						<StarIcon
							size={18}
							weight={email.starred ? "fill" : "regular"}
							className={email.starred ? "text-kumo-warning" : ""}
						/>
					}
					onClick={handleToggleStar}
					aria-label={email.starred ? "Unstar" : "Star"}
				/>
			</Tooltip>

			<Tooltip content="Contact context" side="bottom" asChild>
				<Button
					variant={isSocialContextOpen ? "secondary" : "ghost"}
					shape="square"
					size="sm"
					icon={<SparkleIcon size={18} />}
					onClick={toggleSocialContext}
					aria-label="Contact context"
				/>
			</Tooltip>

			<Tooltip content={isBlocked ? "Unblock" : "Block"} side="bottom" asChild>
				<Button
					variant={isBlocked ? "secondary" : "ghost"}
					shape="square"
					size="sm"
					icon={
						<ProhibitIcon
							size={18}
							weight={isBlocked ? "fill" : "regular"}
							className={isBlocked ? "text-kumo-error" : ""}
						/>
					}
					onClick={handleToggleBlock}
					loading={updateContactProfile.isPending}
					aria-label={isBlocked ? "Unblock contact" : "Block contact"}
				/>
			</Tooltip>

			<Tooltip content="Trash" side="bottom" asChild>
				<Button
					variant="ghost"
					shape="square"
					size="sm"
					icon={<TrashIcon size={18} />}
					onClick={handleMoveToTrash}
					loading={moveThread.isPending}
					aria-label="Move conversation to Trash"
				/>
			</Tooltip>
		</div>
	);
}