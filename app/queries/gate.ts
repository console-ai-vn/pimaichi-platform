import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "~/services/api"
import { queryKeys } from "./keys"

export function useGateCheck(mailboxId: string, emailId: string) {
	return useQuery({
		queryKey: mailboxId && emailId
			? queryKeys.gate.check(mailboxId, emailId)
			: ["gate", "check", "_disabled"],
		queryFn: () => api.checkGate(mailboxId, emailId),
		enabled: !!mailboxId && !!emailId,
	})
}

export function useGateUnlock(mailboxId: string, emailId: string) {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (itemId: string) => api.unlockGate(mailboxId, emailId, itemId),
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: queryKeys.gate.check(mailboxId, emailId),
			})
			qc.invalidateQueries({
				queryKey: queryKeys.gate.status(mailboxId, emailId),
			})
		},
	})
}

export function useGateStatus(mailboxId: string, emailId: string) {
	return useQuery({
		queryKey: mailboxId && emailId
			? queryKeys.gate.status(mailboxId, emailId)
			: ["gate", "status", "_disabled"],
		queryFn: () => api.getGateStatus(mailboxId, emailId),
		enabled: !!mailboxId && !!emailId,
	})
}
