import type { LiveDO } from "../durableObject/live"
import type { Env } from "../types"

export function getLiveStub(env: Env, eventId: string): DurableObjectStub<LiveDO> {
	const id = env.LIVE.idFromName(eventId)
	return env.LIVE.get(id) as unknown as DurableObjectStub<LiveDO>
}
