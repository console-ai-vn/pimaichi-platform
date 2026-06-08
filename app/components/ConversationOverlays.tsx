import { Button } from "@cloudflare/kumo";
import { RobotIcon, XIcon } from "@phosphor-icons/react";
import { useParams } from "react-router";
import AgentSidebar from "~/components/AgentSidebar";
import SocialContextSheet from "~/components/conversation-social/SocialContextSheet";
import EmailPanelDialogs from "~/components/email-panel/EmailPanelDialogs";
import { useEmail } from "~/queries/emails";
import { useUIStore } from "~/hooks/useUIStore";
import type { Email } from "~/types";

interface ConversationOverlaysProps {
	sourceViewEmail: Email | null;
	onCloseSource: () => void;
}

export default function ConversationOverlays({
	sourceViewEmail,
	onCloseSource,
}: ConversationOverlaysProps) {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const {
		selectedEmailId,
		isAgentPanelOpen,
		closeAgentPanel,
		isSocialContextOpen,
		closeSocialContext,
	} = useUIStore();
	const { data: email } = useEmail(mailboxId, selectedEmailId ?? undefined);

	if (!mailboxId || !selectedEmailId || !email) {
		return (
			<EmailPanelDialogs
				sourceViewEmail={sourceViewEmail}
				previewImage={null}
				onCloseSource={onCloseSource}
				onClosePreview={() => {}}
			/>
		);
	}

	return (
		<>
			<EmailPanelDialogs
				sourceViewEmail={sourceViewEmail}
				previewImage={null}
				onCloseSource={onCloseSource}
				onClosePreview={() => {}}
			/>

			{isAgentPanelOpen && (
				<div className="fixed inset-0 z-50 flex justify-end bg-black/20">
					<div className="flex h-full w-full max-w-md flex-col border-l border-kumo-line bg-kumo-base shadow-xl">
						<div className="flex items-center justify-between border-b border-kumo-line px-3 py-2">
							<div className="flex items-center gap-2 text-sm font-semibold text-kumo-strong">
								<RobotIcon size={16} />
								<span>AI Agent</span>
							</div>
							<Button
								variant="ghost"
								shape="square"
								size="sm"
								icon={<XIcon size={18} />}
								onClick={closeAgentPanel}
								aria-label="Close AI agent"
							/>
						</div>
						<div className="min-h-0 flex-1">
							<AgentSidebar />
						</div>
					</div>
				</div>
			)}

			<SocialContextSheet
				open={isSocialContextOpen}
				mailboxId={mailboxId}
				email={email}
				onClose={closeSocialContext}
			/>
		</>
	);
}