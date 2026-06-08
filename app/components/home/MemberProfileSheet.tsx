import { Button, Loader } from "@cloudflare/kumo";
import {
	EnvelopeSimpleIcon,
	GlobeIcon,
	MapPinIcon,
	PaperPlaneTiltIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useNavigate, useParams } from "react-router";
import MailboxAvatar from "~/components/MailboxAvatar";
import MailboxCover from "~/components/MailboxCover";
import { useUIStore } from "~/hooks/useUIStore";
import { useMailbox, useMailboxes } from "~/queries/mailboxes";
import type { Mailbox } from "~/types";

interface MemberProfileSheetProps {
	email: string;
	open: boolean;
	onClose: () => void;
}

function mailboxDisplayName(mailbox: Mailbox) {
	return (
		mailbox.settings?.fromName?.trim() ||
		mailbox.name ||
		mailbox.email.split("@")[0] ||
		mailbox.email
	);
}

function fallbackMailbox(email: string): Mailbox {
	const normalized = email.trim().toLowerCase();
	return {
		id: normalized,
		email: normalized,
		name: normalized.split("@")[0] || normalized,
	};
}

function findMailboxByEmail(mailboxes: Mailbox[] | undefined, email: string) {
	const normalized = email.trim().toLowerCase();
	return mailboxes?.find(
		(mailbox) =>
			mailbox.email.toLowerCase() === normalized ||
			mailbox.id.toLowerCase() === normalized,
	);
}

function formatWebsite(url: string) {
	try {
		const parsed = new URL(url.includes("://") ? url : `https://${url}`);
		return parsed.hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

export default function MemberProfileSheet({
	email,
	open,
	onClose,
}: MemberProfileSheetProps) {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const navigate = useNavigate();
	const { startCompose, closeSidebar } = useUIStore();
	const normalized = email.trim().toLowerCase();
	const { data: mailboxes } = useMailboxes();
	const cached = findMailboxByEmail(mailboxes, normalized);
	const {
		data: fetchedMailbox,
		isPending: fetchPending,
		isError,
	} = useMailbox(open ? normalized : undefined);
	const mailbox = fetchedMailbox ?? cached ?? (isError ? fallbackMailbox(normalized) : undefined);
	const settings = mailbox?.settings;
	const isLoading = open && fetchPending && !mailbox;

	if (!open) return null;

	const handleMessage = () => {
		if (!mailboxId) return;
		onClose();
		closeSidebar();
		navigate(`/mailbox/${mailboxId}/emails/inbox`);
		startCompose({ mode: "new", prefillTo: email.trim().toLowerCase() });
	};

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
			<div className="w-full max-w-md overflow-hidden rounded-xl border border-kumo-line bg-kumo-base shadow-xl">
				<div className="relative">
					<MailboxCover
						email={email}
						coverVersion={settings?.coverUpdatedAt}
						className="h-24 w-full"
					/>
					<Button
						type="button"
						variant="ghost"
						shape="square"
						size="sm"
						className="absolute right-2 top-2 bg-kumo-base/80"
						icon={<XIcon size={16} />}
						onClick={onClose}
						aria-label="Close profile"
					/>
				</div>

				<div className="relative px-5 pb-5">
					<div className="-mt-10 mb-3">
						<MailboxAvatar
							email={email}
							name={mailbox ? mailboxDisplayName(mailbox) : undefined}
							size="xl"
							variant="brand"
							avatarVersion={settings?.avatarUpdatedAt}
							className="ring-4 ring-kumo-base"
						/>
					</div>

					{isLoading ? (
						<div className="flex justify-center py-8">
							<Loader />
						</div>
					) : !mailbox ? (
						<p className="py-6 text-sm text-kumo-subtle">Could not load profile.</p>
					) : (
						<>
							<h2 className="text-lg font-semibold text-kumo-default">
								{mailboxDisplayName(mailbox)}
							</h2>
							<a
								href={`mailto:${mailbox.email}`}
								className="mt-1 inline-flex items-center gap-1.5 text-sm text-kumo-link hover:underline"
							>
								<EnvelopeSimpleIcon size={14} />
								{mailbox.email}
							</a>

							{settings?.bio && (
								<p className="mt-4 text-sm leading-relaxed text-kumo-strong whitespace-pre-wrap">
									{settings.bio}
								</p>
							)}

							<div className="mt-4 space-y-2 text-sm text-kumo-subtle">
								{settings?.location && (
									<div className="flex items-center gap-2">
										<MapPinIcon size={16} className="shrink-0" />
										<span>{settings.location}</span>
									</div>
								)}
								{settings?.website && (
									<div className="flex items-center gap-2">
										<GlobeIcon size={16} className="shrink-0" />
										<a
											href={
												settings.website.includes("://")
													? settings.website
													: `https://${settings.website}`
											}
											target="_blank"
											rel="noopener noreferrer"
											className="text-kumo-link hover:underline"
										>
											{formatWebsite(settings.website)}
										</a>
									</div>
								)}
							</div>

							{mailboxId && mailboxId.toLowerCase() !== mailbox.email.toLowerCase() && (
								<div className="mt-5">
									<Button
										variant="primary"
										size="sm"
										className="w-full"
										icon={<PaperPlaneTiltIcon size={16} />}
										onClick={handleMessage}
									>
										Send email
									</Button>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}