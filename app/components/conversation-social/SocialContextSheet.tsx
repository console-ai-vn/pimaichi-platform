import { Button } from "@cloudflare/kumo";
import { FloppyDiskIcon, SparkleIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { getConversationPeer } from "~/lib/conversation-peer";
import { useContactProfile, useUpdateContactProfile } from "~/queries/emails";
import { useMailbox } from "~/queries/mailboxes";
import type { Email } from "~/types";

interface SocialContextSheetProps {
	open: boolean;
	mailboxId?: string;
	email: Email;
	onClose: () => void;
}

const STAGES = ["new", "warm", "active", "waiting", "closed"];

const inputClassName =
	"w-full rounded-md border border-kumo-line bg-kumo-base px-2.5 py-2 text-sm text-kumo-default outline-none focus:border-kumo-brand";

function initialsFor(value?: string | null) {
	const name = value?.trim();
	if (!name) return "?";
	return name
		.split(/[\s._-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}

export default function SocialContextSheet({
	open,
	mailboxId,
	email,
	onClose,
}: SocialContextSheetProps) {
	const { folder } = useParams<{ folder: string }>();
	const { data: mailbox } = useMailbox(mailboxId);
	const peer = useMemo(
		() => getConversationPeer(email, mailbox?.email, folder),
		[email, mailbox?.email, folder],
	);
	const primaryEmail = peer.email.trim().toLowerCase();
	const { data: contactProfile } = useContactProfile(mailboxId, primaryEmail);
	const updateContactProfile = useUpdateContactProfile();
	const [displayName, setDisplayName] = useState("");
	const [stage, setStage] = useState("new");
	const [tags, setTags] = useState("");
	const [bio, setBio] = useState("");
	const [memory, setMemory] = useState("");

	useEffect(() => {
		setDisplayName(contactProfile?.display_name ?? "");
		setStage(contactProfile?.relationship_stage || "new");
		setTags(contactProfile?.tags ?? "");
		setBio(contactProfile?.bio ?? "");
		setMemory(contactProfile?.memory ?? "");
	}, [contactProfile]);

	const saveProfile = async () => {
		if (!mailboxId || !primaryEmail) return;
		await updateContactProfile.mutateAsync({
			mailboxId,
			emailAddress: primaryEmail,
			profile: {
				display_name: displayName.trim() || null,
				relationship_stage: stage || "new",
				tags: tags.trim() || null,
				bio: bio.trim() || null,
				memory: memory.trim() || null,
			},
		});
	};

	if (!open) return null;

	const heading = displayName.trim() || peer.name;

	return (
		<div className="fixed inset-0 z-50 md:absolute md:inset-y-0 md:right-0 md:left-auto md:w-72">
			<button
				type="button"
				className="absolute inset-0 bg-black/20 md:hidden"
				onClick={onClose}
				aria-label="Close context"
			/>
			<aside className="absolute inset-x-0 bottom-0 max-h-[78vh] rounded-t-xl border border-kumo-line bg-kumo-base shadow-xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:rounded-none md:border-y-0 md:border-r-0">
				<div className="flex items-center justify-between border-b border-kumo-line px-4 py-3">
					<h3 className="text-sm font-semibold text-kumo-default">Contact</h3>
					<Button
						variant="ghost"
						shape="square"
						size="sm"
						icon={<XIcon size={16} />}
						onClick={onClose}
						aria-label="Close contact"
					/>
				</div>

				<div className="space-y-4 overflow-y-auto px-4 py-4">
					<div className="flex items-center gap-3">
						<div className="grid size-10 shrink-0 place-items-center rounded-full bg-kumo-brand text-sm font-semibold text-white">
							{initialsFor(heading)}
						</div>
						<div className="min-w-0">
							<p className="truncate text-sm font-semibold text-kumo-default">{heading}</p>
							<p className="truncate text-xs text-kumo-subtle">{primaryEmail}</p>
						</div>
					</div>

					<label className="block space-y-1">
						<span className="text-xs font-medium text-kumo-subtle">Display name</span>
						<input
							className={inputClassName}
							value={displayName}
							onChange={(event) => setDisplayName(event.target.value)}
							placeholder="How you call them"
						/>
					</label>

					<label className="block space-y-1">
						<span className="text-xs font-medium text-kumo-subtle">Stage</span>
						<select
							className={inputClassName}
							value={stage}
							onChange={(event) => setStage(event.target.value)}
						>
							{STAGES.map((value) => (
								<option key={value} value={value}>
									{value}
								</option>
							))}
						</select>
					</label>

					<label className="block space-y-1">
						<span className="text-xs font-medium text-kumo-subtle">Tags</span>
						<input
							className={inputClassName}
							value={tags}
							onChange={(event) => setTags(event.target.value)}
							placeholder="client, vip, partner"
						/>
					</label>

					<label className="block space-y-1">
						<span className="text-xs font-medium text-kumo-subtle">Bio</span>
						<textarea
							className={`${inputClassName} h-16 resize-none`}
							value={bio}
							onChange={(event) => setBio(event.target.value)}
							placeholder="Who they are, role, context"
						/>
					</label>

					<label className="block space-y-1">
						<span className="flex items-center gap-1 text-xs font-medium text-kumo-subtle">
							<SparkleIcon size={12} />
							AI memory
						</span>
						<textarea
							className={`${inputClassName} h-24 resize-none`}
							value={memory}
							onChange={(event) => setMemory(event.target.value)}
							placeholder="What should AI remember about this person?"
						/>
					</label>

					<Button
						variant="primary"
						size="sm"
						className="w-full"
						icon={<FloppyDiskIcon size={14} />}
						onClick={saveProfile}
						loading={updateContactProfile.isPending}
						disabled={!mailboxId || !primaryEmail}
					>
						Save
					</Button>
				</div>
			</aside>
		</div>
	);
}