import { Button, Input, Loader, useKumoToastManager } from "@cloudflare/kumo";
import { CameraIcon, FloppyDiskIcon, LinkIcon, MapPinIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import api from "~/services/api";
import { queryKeys } from "~/queries/keys";
import MailboxAvatar from "~/components/MailboxAvatar";
import MailboxCover from "~/components/MailboxCover";
import {
	useMailbox,
	useUpdateMailbox,
	useUploadMailboxAvatar,
	useUploadMailboxCover,
} from "~/queries/mailboxes";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

function validateImage(file: File, maxMb: number) {
	if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number])) {
		return "Use JPEG, PNG, or WebP";
	}
	if (file.size > maxMb * 1024 * 1024) {
		return `Image must be ${maxMb}MB or smaller`;
	}
	return null;
}

export default function SettingsRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const toastManager = useKumoToastManager();
	const { data: mailbox } = useMailbox(mailboxId);
	const updateMailbox = useUpdateMailbox();
	const uploadAvatar = useUploadMailboxAvatar();
	const uploadCover = useUploadMailboxCover();
	const avatarInputRef = useRef<HTMLInputElement>(null);
	const coverInputRef = useRef<HTMLInputElement>(null);

	const [displayName, setDisplayName] = useState("");
	const [bio, setBio] = useState("");
	const [location, setLocation] = useState("");
	const [website, setWebsite] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [avatarVersion, setAvatarVersion] = useState<string | null>(null);
	const [coverVersion, setCoverVersion] = useState<string | null>(null);
	const [isPublicBoard, setIsPublicBoard] = useState(false);
	const [boardName, setBoardName] = useState("");
	const [boardDescription, setBoardDescription] = useState("");
	const { data: config } = useQuery({
		queryKey: queryKeys.config,
		queryFn: () => api.getConfig(),
	});
	const isAdmin = config?.isAdmin ?? false;

	useEffect(() => {
		if (!mailbox) return;
		setDisplayName(mailbox.settings?.fromName || mailbox.name || "");
		setBio(mailbox.settings?.bio || "");
		setLocation(mailbox.settings?.location || "");
		setWebsite(mailbox.settings?.website || "");
		setAvatarVersion(mailbox.settings?.avatarUpdatedAt ?? null);
		setCoverVersion(mailbox.settings?.coverUpdatedAt ?? null);
		setIsPublicBoard(mailbox.settings?.isPublicBoard === true);
		setBoardName(mailbox.settings?.boardName || "");
		setBoardDescription(mailbox.settings?.boardDescription || "");
	}, [mailbox]);

	const handleSave = async () => {
		if (!mailbox || !mailboxId) return;
		setIsSaving(true);
		const settings = {
			...mailbox.settings,
			fromName: displayName.trim() || mailbox.name,
			bio: bio.trim() || undefined,
			location: location.trim() || undefined,
			website: website.trim() || undefined,
			...(isAdmin
				? {
						isPublicBoard,
						boardName: isPublicBoard
							? boardName.trim() || displayName.trim() || mailbox.name
							: undefined,
						boardDescription: isPublicBoard
							? boardDescription.trim() || undefined
							: undefined,
					}
				: {}),
		};
		try {
			await updateMailbox.mutateAsync({ mailboxId, settings });
			toastManager.add({ title: "Profile saved" });
		} catch {
			toastManager.add({ title: "Failed to save profile", variant: "error" });
		} finally {
			setIsSaving(false);
		}
	};

	const handleImagePick = async (
		file: File | undefined,
		kind: "avatar" | "cover",
	) => {
		if (!mailboxId || !file) return;
		const maxMb = kind === "avatar" ? 2 : 4;
		const validationError = validateImage(file, maxMb);
		if (validationError) {
			toastManager.add({ title: validationError, variant: "error" });
			return;
		}
		try {
			if (kind === "avatar") {
				const result = await uploadAvatar.mutateAsync({ mailboxId, file });
				setAvatarVersion(result.avatarUpdatedAt);
				toastManager.add({ title: "Profile photo updated" });
			} else {
				const result = await uploadCover.mutateAsync({ mailboxId, file });
				setCoverVersion(result.coverUpdatedAt);
				toastManager.add({ title: "Cover photo updated" });
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to upload photo";
			toastManager.add({ title: message, variant: "error" });
		} finally {
			const inputRef = kind === "avatar" ? avatarInputRef : coverInputRef;
			if (inputRef.current) inputRef.current.value = "";
		}
	};

	if (!mailbox) {
		return (
			<div className="flex justify-center py-20">
				<Loader size="lg" />
			</div>
		);
	}

	return (
		<div className="h-full overflow-y-auto bg-kumo-recessed">
			<div className="mx-auto max-w-2xl">
				<button
					type="button"
					onClick={() => coverInputRef.current?.click()}
					disabled={uploadCover.isPending}
					className="group relative block h-36 w-full md:h-44"
					aria-label="Change cover photo"
				>
					<MailboxCover
						email={mailbox.email}
						coverVersion={coverVersion}
						className="h-full w-full"
					/>
					<span className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
						<span className="inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-sm font-medium text-white">
							<CameraIcon size={18} />
							{uploadCover.isPending ? "Uploading..." : "Change cover"}
						</span>
					</span>
				</button>
				<input
					ref={coverInputRef}
					type="file"
					accept="image/jpeg,image/png,image/webp"
					className="hidden"
					onChange={(e) => void handleImagePick(e.target.files?.[0], "cover")}
				/>

				<div className="relative px-4 pb-6 md:px-8">
					<div className="-mt-14 mb-4 flex items-end justify-between gap-3">
						<button
							type="button"
							onClick={() => avatarInputRef.current?.click()}
							disabled={uploadAvatar.isPending}
							className="group relative shrink-0 rounded-full border-4 border-kumo-base shadow-md focus:outline-none focus:ring-2 focus:ring-kumo-ring disabled:opacity-70"
							aria-label="Change profile photo"
						>
							<MailboxAvatar
								email={mailbox.email}
								name={displayName}
								size="xl"
								variant="brand"
								avatarVersion={avatarVersion}
								className="border-0"
							/>
							<span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
								<CameraIcon size={28} className="text-white" />
							</span>
						</button>
						<input
							ref={avatarInputRef}
							type="file"
							accept="image/jpeg,image/png,image/webp"
							className="hidden"
							onChange={(e) => void handleImagePick(e.target.files?.[0], "avatar")}
						/>
						<Button
							variant="primary"
							size="sm"
							icon={<FloppyDiskIcon size={16} />}
							onClick={handleSave}
							loading={isSaving}
						>
							Save profile
						</Button>
					</div>

					<div className="space-y-1">
						<h1 className="text-2xl font-bold text-kumo-default">
							{displayName || mailbox.email.split("@")[0]}
						</h1>
						<p className="text-sm text-kumo-subtle">{mailbox.email}</p>
					</div>

					{bio && (
						<p className="mt-4 text-sm leading-relaxed text-kumo-default">{bio}</p>
					)}

					<div className="mt-3 flex flex-wrap gap-3 text-sm text-kumo-subtle">
						{location && (
							<span className="inline-flex items-center gap-1.5">
								<MapPinIcon size={16} />
								{location}
							</span>
						)}
						{website && (
							<a
								href={website.startsWith("http") ? website : `https://${website}`}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center gap-1.5 text-kumo-brand hover:underline"
							>
								<LinkIcon size={16} />
								{website.replace(/^https?:\/\//, "")}
							</a>
						)}
					</div>

					<div className="mt-8 space-y-5 rounded-xl border border-kumo-line bg-kumo-base p-5">
						<h2 className="text-sm font-semibold text-kumo-default">Edit profile</h2>
						<p className="text-xs text-kumo-subtle">
							Click cover or avatar to upload. Photos sync across inbox and threads.
						</p>
						<Input
							label="Display name"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							placeholder="How you appear when sending mail"
						/>
						<label className="block space-y-1.5">
							<span className="text-sm font-medium text-kumo-default">Bio</span>
							<textarea
								className="min-h-24 w-full resize-y rounded-lg border border-kumo-line bg-kumo-recessed px-3 py-2 text-sm text-kumo-default placeholder:text-kumo-subtle focus:outline-none focus:ring-1 focus:ring-kumo-ring"
								value={bio}
								onChange={(e) => setBio(e.target.value)}
								placeholder="Short intro — role, team, what you do"
							/>
						</label>
						<Input
							label="Location"
							value={location}
							onChange={(e) => setLocation(e.target.value)}
							placeholder="Ho Chi Minh City"
						/>
						<Input
							label="Website"
							value={website}
							onChange={(e) => setWebsite(e.target.value)}
							placeholder="vsbg.vn"
						/>
						<Input label="Email" type="email" value={mailbox.email} disabled />
						{isAdmin && (
							<div className="space-y-3 rounded-lg border border-kumo-line bg-kumo-recessed p-4">
								<h3 className="text-sm font-semibold text-kumo-default">Board settings</h3>
								<label className="flex items-center gap-2 text-sm text-kumo-default">
									<input
										type="checkbox"
										checked={isPublicBoard}
										onChange={(e) => setIsPublicBoard(e.target.checked)}
									/>
									Public board (curated forum)
								</label>
								{isPublicBoard && (
									<>
										<Input
											label="Board name"
											value={boardName}
											onChange={(e) => setBoardName(e.target.value)}
											placeholder="Sales"
										/>
										<label className="block space-y-1.5">
											<span className="text-sm font-medium text-kumo-default">
												Board description
											</span>
											<textarea
												className="min-h-20 w-full resize-y rounded-lg border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default placeholder:text-kumo-subtle focus:outline-none focus:ring-1 focus:ring-kumo-ring"
												value={boardDescription}
												onChange={(e) => setBoardDescription(e.target.value)}
												placeholder="What this board is for"
											/>
										</label>
									</>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}