import {html as format} from 'telegram-format'
import {Telegram} from 'telegraf'

import {Mission} from './hunter'

let telegram: Telegram

export function init(tg: Telegram): void {
	telegram = tg
}

export async function notifyChange(issuer: string, mission: Mission, change: boolean | undefined): Promise<void> {
	if (change === false) {
		return
	}

	const user = issuer.slice(2)
	let text = ''
	text += mission.type + ' changed on'
	text += '\n'
	text += mission.url

	await telegram.sendMessage(user, text)
}

export async function notifyError(issuer: string, mission: Mission, error: any): Promise<void> {
	console.error('MISSION ERROR', issuer, mission, error)

	const user = issuer.slice(2)
	let text = ''

	text += 'Something went wrong'
	text += '\n'
	text += mission.url
	text += '\n'
	text += format.monospaceBlock(JSON.stringify(mission, undefined, '  '))
	text += format.monospaceBlock(JSON.stringify(error, undefined, '  '))

	await telegram.sendMessage(user, text, {
		parse_mode: format.parse_mode
	})
}
