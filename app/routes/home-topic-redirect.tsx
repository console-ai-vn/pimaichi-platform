import { Loader } from "@cloudflare/kumo";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useMailboxes } from "~/queries/mailboxes";

export default function HomeTopicRedirectRoute() {
	const { topicId } = useParams<{ topicId: string }>();
	const navigate = useNavigate();
	const { data: mailboxes = [], isFetched } = useMailboxes();

	useEffect(() => {
		if (!isFetched || !topicId) return;
		if (mailboxes.length > 0) {
			navigate(`/mailbox/${mailboxes[0].id}/feed/topics/${topicId}`, {
				replace: true,
			});
			return;
		}
		navigate("/app", { replace: true });
	}, [isFetched, mailboxes, navigate, topicId]);

	return (
		<div className="flex justify-center py-16">
			<Loader />
		</div>
	);
}