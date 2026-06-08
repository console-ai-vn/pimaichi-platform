import { createContext, useContext } from "react";
import type { Email } from "~/types";

export interface ConversationActionsContextValue {
	onViewSource: (email: Email) => void;
}

export const ConversationActionsContext =
	createContext<ConversationActionsContextValue | null>(null);

export function useConversationActions() {
	return useContext(ConversationActionsContext);
}