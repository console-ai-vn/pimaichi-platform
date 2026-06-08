import type { OrgFeedDO } from "../durableObject/orgFeed";
import type { Env } from "../types";

export const ORG_FEED_NAME = "vsbg-home";

export function getOrgFeedStub(env: Env): DurableObjectStub<OrgFeedDO> {
	const id = env.ORG_FEED.idFromName(ORG_FEED_NAME);
	return env.ORG_FEED.get(id);
}