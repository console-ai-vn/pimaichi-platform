// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Button,
	Dialog,
	Empty,
	Input,
	Loader,
	Select,
	Text,
	useKumoToastManager,
} from "@cloudflare/kumo";
import { EnvelopeIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router";
import api from "~/services/api";
import MailboxAvatar from "~/components/MailboxAvatar";
import {
	useCreateMailbox,
	useDeleteMailbox,
	useMailboxes,
} from "~/queries/mailboxes";
import { queryKeys } from "~/queries/keys";

export function meta() {
	return [{ title: "VSBG Box" }];
}

export default function HomeRoute() {
	const toastManager = useKumoToastManager();
	const navigate = useNavigate();
	const { data: mailboxes = [], refetch: refetchMailboxes, isFetched: mailboxesFetched } = useMailboxes();
	const createMailbox = useCreateMailbox();
	const deleteMailbox = useDeleteMailbox();

	const { data: configData } = useQuery({
		queryKey: queryKeys.config,
		queryFn: () => api.getConfig(),
		staleTime: Infinity, // config rarely changes
	});

	const domains = configData?.domains ?? [];
	const emailAddresses = configData?.emailAddresses ?? [];
	const isAdmin = configData?.isAdmin ?? false;

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [newPrefix, setNewPrefix] = useState("");
	const [selectedDomain, setSelectedDomain] = useState("");
	const [newName, setNewName] = useState("");
	const [isPublicBoard, setIsPublicBoard] = useState(false);
	const [boardName, setBoardName] = useState("");
	const [boardDescription, setBoardDescription] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [mailboxToDelete, setMailboxToDelete] = useState<{
		id: string;
		email: string;
	} | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// Set default domain when config loads
	useEffect(() => {
		if (domains.length > 0 && !selectedDomain) {
			setSelectedDomain(domains[0]);
		}
	}, [domains, selectedDomain]);

	// Auto-create mailboxes from config (run once when both data sources are ready)
	const autoCreateDone = useRef(false);
	useEffect(() => {
		if (autoCreateDone.current) return;
		if (emailAddresses.length === 0 || !mailboxesFetched) return;
		const existingEmails = new Set(
			mailboxes.map((m) => m.email.toLowerCase()),
		);
		const toCreate = emailAddresses.filter(
			(addr) => !existingEmails.has(addr.toLowerCase()),
		);
		if (toCreate.length === 0) {
			autoCreateDone.current = true;
			return;
		}
		autoCreateDone.current = true;
		let cancelled = false;
		Promise.all(
			toCreate.map((addr) => {
				const localPart = addr.split("@")[0] || addr;
				return api.createMailbox(addr, localPart).catch(() => {});
			}),
		).then(() => { if (!cancelled) refetchMailboxes(); });
		return () => { cancelled = true; };
	}, [emailAddresses, mailboxes, refetchMailboxes]);

	const handleCreate = async (e: FormEvent) => {
		e.preventDefault();
		setCreateError(null);
		if (!newPrefix || !selectedDomain) {
			setCreateError("Please fill in all fields");
			return;
		}
		const email = `${newPrefix}@${selectedDomain}`;
		const name = newName || newPrefix;
		setIsCreating(true);
		try {
			const settings = isPublicBoard
				? {
						isPublicBoard: true,
						boardName: boardName.trim() || name,
						boardDescription: boardDescription.trim() || undefined,
					}
				: undefined;
			await createMailbox.mutateAsync({ email, name, settings });
			toastManager.add({
				title: isPublicBoard ? "Board created!" : "Mailbox created successfully!",
			});
			setIsCreateOpen(false);
			setNewPrefix("");
			setNewName("");
			setIsPublicBoard(false);
			setBoardName("");
			setBoardDescription("");
		} catch (err: unknown) {
			const message = (err instanceof Error ? err.message : null) || "Failed to create mailbox";
			setCreateError(message);
		} finally {
			setIsCreating(false);
		}
	};

	const handleDelete = async () => {
		if (!mailboxToDelete) return;
		setIsDeleting(true);
		try {
			await deleteMailbox.mutateAsync(mailboxToDelete.id);
			toastManager.add({ title: "Mailbox deleted" });
			setIsDeleteOpen(false);
			setMailboxToDelete(null);
		} catch {
			toastManager.add({ title: "Failed to delete mailbox", variant: "error" });
		} finally {
			setIsDeleting(false);
		}
	};

	const isConfigured = emailAddresses.length > 0;
	const accounts = mailboxes;

	useEffect(() => {
		if (accounts.length === 1) {
			navigate(`/mailbox/${accounts[0].id}`, { replace: true });
		}
	}, [accounts, navigate]);

	const isLoading = !configData;

	return (
		<div className="min-h-screen bg-kumo-recessed">
			<div className="mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-16">
				<div className="mb-8">
					<div className="flex items-center justify-between">
						<h1 className="text-2xl font-bold text-kumo-default">Mailboxes</h1>
						{(isAdmin || !isConfigured) && (
							<Button
								variant="primary"
								icon={<PlusIcon size={16} />}
								onClick={() => {
									setIsPublicBoard(isAdmin);
									setIsCreateOpen(true);
								}}
							>
								{isAdmin ? "New board" : "New Mailbox"}
							</Button>
						)}
					</div>
					{domains.length > 0 && (
						<p className="text-sm text-kumo-subtle mt-1">
							{domains.join(", ")}
						</p>
					)}
				</div>

				{isLoading ? (
					<div className="flex justify-center py-20">
						<Loader size="lg" />
					</div>
				) : accounts.length > 0 ? (
					<div className="rounded-xl border border-kumo-line bg-kumo-base overflow-hidden">
						{accounts.map((account, idx) => (
							<RouterLink
								key={account.id}
								to={`/mailbox/${account.id}`}
								className={`group flex items-center gap-4 px-5 py-4 no-underline transition-colors hover:bg-kumo-tint ${
									idx > 0 ? "border-t border-kumo-line" : ""
								}`}
							>
								<MailboxAvatar
									email={account.email}
									name={account.settings?.fromName || account.name}
									size="md"
									variant="muted"
									avatarVersion={account.settings?.avatarUpdatedAt}
								/>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<div className="text-sm font-medium text-kumo-default truncate">
											{account.settings?.boardName || account.settings?.fromName || account.name}
										</div>
										{account.settings?.isPublicBoard && (
											<span className="shrink-0 rounded-full bg-kumo-brand/10 px-2 py-0.5 text-xs font-medium text-kumo-brand">
												Board
											</span>
										)}
									</div>
									<div className="text-sm text-kumo-subtle">
										{account.email}
									</div>
								</div>
								{isAdmin && (
									<Button
										variant="ghost"
										size="sm"
										shape="square"
										icon={<TrashIcon size={16} />}
										aria-label={`Delete mailbox ${account.email}`}
										onClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setMailboxToDelete({
												id: account.id,
												email: account.email,
											});
											setIsDeleteOpen(true);
										}}
									/>
								)}
							</RouterLink>
						))}
					</div>
				) : (
					<div className="rounded-xl border border-kumo-line bg-kumo-base py-16 px-6">
						<div className="flex flex-col items-center text-center">
							<div className="mb-4">
								<EnvelopeIcon
									size={48}
									weight="thin"
									className="text-kumo-subtle"
								/>
							</div>
							<h3 className="text-base font-semibold text-kumo-default mb-1.5">
								No mailboxes yet
							</h3>
							<p className="text-sm text-kumo-subtle max-w-sm mb-5">
								{isConfigured
									? "Your email routing is configured but no mailboxes have been created yet. They will appear here automatically."
									: "Create a mailbox to start sending and receiving emails with your domain."}
							</p>
							{!isConfigured && (
								<Button
									variant="primary"
									icon={<PlusIcon size={16} />}
									onClick={() => {
									setIsPublicBoard(isAdmin);
									setIsCreateOpen(true);
								}}
								>
									Create Mailbox
								</Button>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Create Dialog */}
			<Dialog.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-5">
						{isAdmin ? "Create board" : "Create New Mailbox"}
					</Dialog.Title>
					<form onSubmit={handleCreate} className="space-y-4">
						{createError && (
							<Text variant="error" size="sm">
								{createError}
							</Text>
						)}
						<div>
							<span className="text-sm font-medium text-kumo-default mb-1.5 block">
								Email Address
							</span>
							<div className="flex items-center gap-2">
								<div className="flex-1">
									<Input
										aria-label="Address prefix"
										placeholder="info"
										size="sm"
										value={newPrefix}
										onChange={(e) => setNewPrefix(e.target.value)}
										required
									/>
								</div>
								<span className="text-sm text-kumo-subtle">@</span>
								{domains.length > 1 ? (
									<div className="flex-1">
							<Select
								aria-label="Domain"
								value={selectedDomain}
								onValueChange={(value) => {
									if (value) setSelectedDomain(value);
								}}
							>
											{domains.map((d) => (
												<Select.Option key={d} value={d}>
													{d}
												</Select.Option>
											))}
										</Select>
									</div>
								) : (
									<span className="text-sm text-kumo-subtle">
										{selectedDomain || "no domain"}
									</span>
								)}
							</div>
						</div>
						<Input
							label="Display Name (optional)"
							placeholder="Info"
							size="sm"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
						/>
						{isAdmin && (
							<>
								<label className="flex items-center gap-2 text-sm text-kumo-default">
									<input
										type="checkbox"
										checked={isPublicBoard}
										onChange={(e) => setIsPublicBoard(e.target.checked)}
									/>
									Public board (team can post here)
								</label>
								{isPublicBoard && (
									<>
										<Input
											label="Board name"
											placeholder="Sales"
											size="sm"
											value={boardName}
											onChange={(e) => setBoardName(e.target.value)}
										/>
										<label className="block space-y-1.5">
											<span className="text-sm font-medium text-kumo-default">
												Board description
											</span>
											<textarea
												className="min-h-20 w-full resize-y rounded-lg border border-kumo-line bg-kumo-recessed px-3 py-2 text-sm text-kumo-default placeholder:text-kumo-subtle focus:outline-none focus:ring-1 focus:ring-kumo-ring"
												value={boardDescription}
												onChange={(e) => setBoardDescription(e.target.value)}
												placeholder="What this board is for"
											/>
										</label>
									</>
								)}
							</>
						)}
						<div className="flex justify-end gap-2 pt-2">
							<Dialog.Close
								render={(props) => (
									<Button {...props} variant="secondary" size="sm">
										Cancel
									</Button>
								)}
							/>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								loading={isCreating}
								disabled={!selectedDomain}
							>
								Create
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>

			{/* Delete Dialog */}
			{isAdmin && <Dialog.Root
				open={isDeleteOpen}
				onOpenChange={(open) => {
					setIsDeleteOpen(open);
					if (!open) setMailboxToDelete(null);
				}}
			>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-2">
						Delete Mailbox
					</Dialog.Title>
					<Dialog.Description className="text-kumo-subtle text-sm mb-5">
						Are you sure you want to delete{" "}
						<strong className="text-kumo-default">
							{mailboxToDelete?.email}
						</strong>
						? This action cannot be undone.
					</Dialog.Description>
					<div className="flex justify-end gap-2">
						<Dialog.Close
							render={(props) => (
								<Button {...props} variant="secondary" size="sm">
									Cancel
								</Button>
							)}
						/>
						<Button
							variant="destructive"
							size="sm"
							loading={isDeleting}
							onClick={handleDelete}
						>
							Delete
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>}
		</div>
	);
}
