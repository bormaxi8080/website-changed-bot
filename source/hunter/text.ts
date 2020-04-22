import {cachedGot} from './got'
import {TextMission} from './mission'

export async function getCurrent(entry: TextMission): Promise<string> {
	const response = await cachedGot(entry.url)
	const {body} = response
	return body
}