import { Button } from "@cloudflare/kumo";
import { EnvelopeSimpleIcon, HouseIcon } from "@phosphor-icons/react";
import { Link, Outlet, useLocation } from "react-router";

export default function HomeLayoutRoute() {
	const location = useLocation();
	const onHome = location.pathname.startsWith("/home");

	return (
		<div className="min-h-screen bg-kumo-recessed">
			<header className="sticky top-0 z-20 border-b border-kumo-line bg-kumo-base/95 backdrop-blur">
				<div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
					<div className="flex items-center gap-2">
						<HouseIcon size={20} className="text-kumo-brand" />
						<span className="font-semibold text-kumo-default">VSBG Home</span>
					</div>
					<nav className="flex items-center gap-2">
						<Link to="/home">
							<Button
								variant={onHome ? "primary" : "secondary"}
								size="sm"
							>
								Feed
							</Button>
						</Link>
						<Link to="/app">
							<Button variant="secondary" size="sm" icon={<EnvelopeSimpleIcon size={16} />}>
								Mailboxes
							</Button>
						</Link>
					</nav>
				</div>
			</header>
			<main className="mx-auto max-w-3xl px-4 py-6">
				<Outlet />
			</main>
		</div>
	);
}