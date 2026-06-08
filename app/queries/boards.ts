import { useQuery } from "@tanstack/react-query";
import api from "~/services/api";
import type { ForumBoard } from "~/types";
import { queryKeys } from "./keys";

export function useBoards() {
	return useQuery<ForumBoard[]>({
		queryKey: queryKeys.boards.all,
		queryFn: () => api.listBoards(),
		staleTime: 60_000,
	});
}