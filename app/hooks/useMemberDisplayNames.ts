import { useMemo } from "react";
import { useMailboxes } from "~/queries/mailboxes";

export function useMemberDisplayNames() {
	const { data: mailboxes } = useMailboxes();
	return useMemo(() => {
		const map = new Map<string, string>();
		for (const mailbox of mailboxes ?? []) {
			const email = mailbox.email?.trim().toLowerCase() || mailbox.id?.trim().toLowerCase();
			if (!email) continue;
			const fromName =
				typeof mailbox.settings?.fromName === "string"
					? mailbox.settings.fromName.trim()
					: "";
			if (fromName) map.set(email, fromName);
		}
		return map;
	}, [mailboxes]);
}

export function resolveMemberDisplayName(
	names: Map<string, string>,
	email: string,
	fallbackName?: string,
) {
	const normalized = email.trim().toLowerCase();
	if (fallbackName?.trim()) return fallbackName.trim();
	return names.get(normalized) || normalized.split("@")[0] || email;
}