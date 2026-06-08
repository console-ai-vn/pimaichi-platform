import { useState } from "react";
import MailboxAvatar from "~/components/MailboxAvatar";
import { getAvatarVersion, useAvatarVersionMap } from "~/hooks/useAvatarVersions";
import {
	resolveMemberDisplayName,
	useMemberDisplayNames,
} from "~/hooks/useMemberDisplayNames";
import MemberProfileSheet from "./MemberProfileSheet";

interface MemberProfileTriggerProps {
	email: string;
	name?: string;
	avatarSize?: "sm" | "md" | "lg";
	showName?: boolean;
	nameClassName?: string;
	layout?: "row" | "avatar-only" | "name-only";
}

export default function MemberProfileTrigger({
	email,
	name,
	avatarSize = "md",
	showName = true,
	nameClassName = "",
	layout = "row",
}: MemberProfileTriggerProps) {
	const [open, setOpen] = useState(false);
	const avatarVersions = useAvatarVersionMap();
	const displayNames = useMemberDisplayNames();
	const normalized = email.trim().toLowerCase();
	const displayName = resolveMemberDisplayName(displayNames, normalized, name);
	const avatarVersion = getAvatarVersion(avatarVersions, normalized);

	const buttonClassName =
		layout === "row"
			? "flex min-w-0 items-center gap-3 rounded-md text-left transition-colors hover:opacity-90"
			: layout === "name-only"
				? "max-w-full truncate rounded-md text-left transition-colors hover:text-kumo-brand"
				: "rounded-full transition-opacity hover:opacity-90";

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className={buttonClassName}
				aria-label={`View ${displayName}'s profile`}
			>
				{layout !== "name-only" && (
					<MailboxAvatar
						email={normalized}
						name={displayName}
						size={avatarSize}
						variant="brand"
						avatarVersion={avatarVersion}
					/>
				)}
				{showName && (layout === "row" || layout === "name-only") && (
					<span className={`truncate text-sm font-medium text-kumo-default ${nameClassName}`}>
						{displayName}
					</span>
				)}
			</button>
			<MemberProfileSheet
				email={normalized}
				open={open}
				onClose={() => setOpen(false)}
			/>
		</>
	);
}