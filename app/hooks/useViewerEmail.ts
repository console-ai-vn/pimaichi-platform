import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "~/queries/keys";
import api from "~/services/api";

export function useViewerEmail() {
	const { data } = useQuery({
		queryKey: queryKeys.config,
		queryFn: () => api.getConfig(),
		staleTime: 60_000,
	});
	return data?.accessEmail?.trim().toLowerCase() ?? "";
}

export function isSameMemberEmail(a: string, b: string) {
	return a.trim().toLowerCase() === b.trim().toLowerCase();
}