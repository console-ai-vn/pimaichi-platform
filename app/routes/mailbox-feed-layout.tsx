import { Outlet } from "react-router";

export default function MailboxFeedLayoutRoute() {
	return (
		<div className="h-full overflow-y-auto bg-kumo-recessed">
			<div className="mx-auto max-w-3xl px-4 py-6">
				<Outlet />
			</div>
		</div>
	);
}