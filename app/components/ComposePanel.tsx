// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Banner, Button, Input, Select } from "@cloudflare/kumo";
import { FloppyDiskIcon, ImageIcon, PaperPlaneTiltIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import { useRef } from "react";
import { useParams } from "react-router";
import { useComposeForm } from "~/hooks/useComposeForm";
import RichTextEditor from "./RichTextEditor";

export default function ComposePanel() {
	const { mailboxId, folder } = useParams<{
		mailboxId: string;
		folder: string;
	}>();

	const {
		to,
		setTo,
		cc,
		setCc,
		bcc,
		setBcc,
		showCcBcc,
		setShowCcBcc,
		subject,
		setSubject,
		body,
		setBody,
		attachments,
		addImageFiles,
		removeAttachment,
		error,
		isSavingDraft,
		isSending,
		formTitle,
		isForumTopic,
		postableBoards,
		handleSaveDraft,
		handleSend,
		closeCompose,
		closePanel,
	} = useComposeForm(mailboxId, folder);
	const fileInputRef = useRef<HTMLInputElement>(null);

	return (
		<div className="flex flex-col h-full bg-kumo-base">
			<div className="flex items-center justify-between px-4 py-3 border-b border-kumo-line shrink-0 md:px-6">
				<h2 className="text-base font-semibold text-kumo-default">
					{formTitle}
				</h2>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						shape="square"
						size="sm"
						icon={<XIcon size={18} />}
						onClick={closeCompose}
						disabled={isSending}
						aria-label="Close compose"
					/>
				</div>
			</div>

			<form
				onSubmit={(e) => handleSend(e, closePanel)}
				className="flex flex-col flex-1 min-h-0 overflow-y-auto"
				onDragOver={(event) => event.preventDefault()}
				onDrop={(event) => {
					event.preventDefault();
					void addImageFiles(Array.from(event.dataTransfer.files));
				}}
				onPaste={(event) => {
					const files = Array.from(event.clipboardData.files);
					if (files.length > 0) void addImageFiles(files);
				}}
			>
				<div className="p-4 md:p-6 space-y-4">
					{error && <Banner variant="error" text={error} />}

					<div className="space-y-3">
						{isForumTopic ? (
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-kumo-subtle w-14 shrink-0">
									Board
								</label>
								<div className="flex-1 min-w-0">
									{postableBoards.length > 0 ? (
										<Select
											aria-label="Board"
											value={to}
											onValueChange={(value) => value && setTo(value)}
										>
											{postableBoards.map((board) => (
												<Select.Option key={board.id} value={board.email}>
													{board.boardName}
												</Select.Option>
											))}
										</Select>
									) : (
										<p className="text-sm text-kumo-subtle">
											No boards available. Ask an admin to create one.
										</p>
									)}
								</div>
							</div>
						) : (
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-kumo-subtle w-14 shrink-0">
									To
								</label>
								<div className="flex-1 flex items-center gap-2 min-w-0">
									<Input
										type="text"
										placeholder="recipient@example.com"
										size="sm"
										value={to}
										onChange={(e) => setTo(e.target.value)}
										required
									/>
									{!showCcBcc && (
										<button
											type="button"
											onClick={() => setShowCcBcc(true)}
											className="shrink-0 text-xs text-kumo-link hover:text-kumo-link-hover font-medium"
										>
											CC / BCC
										</button>
									)}
								</div>
							</div>
						)}

						{!isForumTopic && showCcBcc && (
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-kumo-subtle w-14 shrink-0">
									CC
								</label>
								<div className="flex-1">
									<Input
										type="text"
										size="sm"
										value={cc}
										onChange={(e) => setCc(e.target.value)}
										placeholder="Separate multiple addresses with commas"
									/>
								</div>
							</div>
						)}

						{!isForumTopic && showCcBcc && (
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-kumo-subtle w-14 shrink-0">
									BCC
								</label>
								<div className="flex-1">
									<Input
										type="text"
										size="sm"
										value={bcc}
										onChange={(e) => setBcc(e.target.value)}
										placeholder="Separate multiple addresses with commas"
									/>
								</div>
							</div>
						)}

						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-kumo-subtle w-14 shrink-0">
								Subject
							</label>
							<div className="flex-1">
								<Input
									type="text"
									placeholder={isForumTopic ? "Topic title" : "Email subject"}
									size="sm"
									value={subject}
									onChange={(e) => setSubject(e.target.value)}
									required
								/>
							</div>
						</div>
					</div>

					<div className="border border-kumo-line rounded-md overflow-hidden bg-kumo-base">
						<RichTextEditor
							value={body}
							onChange={setBody}
						/>
					</div>

					<input
						ref={fileInputRef}
						type="file"
						accept="image/jpeg,image/png,image/webp"
						multiple
						className="hidden"
						onChange={(event) => {
							void addImageFiles(Array.from(event.target.files || []));
							event.target.value = "";
						}}
					/>
					<div className="space-y-2">
						<Button
							type="button"
							variant="secondary"
							size="sm"
							icon={<ImageIcon size={14} />}
							onClick={() => fileInputRef.current?.click()}
						>
							Add images
						</Button>
						<p className="text-xs text-kumo-subtle">
							Drop or paste JPEG, PNG, or WebP images. Max 10MB each, 25MB total.
						</p>
						{attachments.map((attachment, index) => (
							<div
								key={`${attachment.filename}-${index}`}
								className="flex items-center gap-2 rounded-md border border-kumo-line px-3 py-2 text-sm"
							>
								<ImageIcon size={16} className="text-kumo-subtle shrink-0" />
								<span className="flex-1 truncate">{attachment.filename}</span>
								<Button
									type="button"
									variant="ghost"
									shape="square"
									size="sm"
									icon={<TrashIcon size={14} />}
									onClick={() => removeAttachment(index)}
									aria-label={`Remove ${attachment.filename}`}
								/>
							</div>
						))}
					</div>
				</div>

				{/* Footer actions */}
				<div className="mt-auto px-4 py-3 border-t border-kumo-line bg-kumo-fill/30 shrink-0 md:px-6">
					<div className="flex items-center justify-between">
						<Button type="button" variant="ghost" size="sm" onClick={closeCompose} disabled={isSending}>
							Discard
						</Button>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="secondary"
								size="sm"
								loading={isSavingDraft}
								disabled={isSending}
								icon={<FloppyDiskIcon size={14} />}
								onClick={handleSaveDraft}
							>
								{isSavingDraft ? "Saving..." : "Save as Draft"}
							</Button>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								loading={isSending}
								disabled={
									isSavingDraft ||
									isSending ||
									(isForumTopic && postableBoards.length === 0)
								}
								icon={<PaperPlaneTiltIcon size={14} />}
							>
								{isSending ? (isForumTopic ? "Posting..." : "Sending...") : isForumTopic ? "Post" : "Send"}
							</Button>
						</div>
					</div>
				</div>
			</form>
		</div>
	);
}
