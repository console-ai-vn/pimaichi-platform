import { Navigate } from "react-router";

export default function HomeRedirectRoute() {
	return <Navigate to="/app" replace />;
}