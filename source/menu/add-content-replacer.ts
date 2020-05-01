import {Composer} from 'telegraf'
import {html as format} from 'telegram-format'
import {MenuTemplate, Body, replyMenuToContext} from 'telegraf-inline-menu'
import TelegrafStatelessQuestion from 'telegraf-stateless-question'

import {ContentReplace} from '../hunter'
import * as userMissions from '../user-missions'

import {backButtons} from './back-buttons'
import {basicInfo} from './lib/mission'
import {Context} from './context'
import {menu as listMenu} from './list'

const DEFAULT_FLAGS = 'g'
const DEFAULT_REPLACE_VALUE = '$1'

export const bot = new Composer<Context>()
export const menu = new MenuTemplate<Context>(menuBody)

function getMissionIndex(context: Context): number {
	const key = context.match![1]
	const index = Number(/^i(\d+)-/.exec(key)![1])
	return index
}

async function lostTrack(context: Context): Promise<void> {
	await context.reply('Wait what? I lost track of things. Lets get me back on track please.')
	await replyMenuToContext(listMenu, context, '/list/')
}

const regexQuestion = new TelegrafStatelessQuestion<Context>('replacer-regex', async context => {
	if (context.session.currentMissionIndex === undefined || !Number.isFinite(context.session.currentMissionIndex)) {
		return lostTrack(context)
	}

	const regex = context.message.text
	if (!regex) {
		await context.reply('Please send the regular expression as a text message')
		await replyMenuToContext(menu, context, `/list/:i${context.session.currentMissionIndex}/replacers/add/`)
		return
	}

	try {
		const flags = context.session.replacerRegexFlags ?? DEFAULT_FLAGS
		new RegExp(regex, flags).test('edjopato')
		context.session.replacerRegexSource = regex
	} catch {
		await context.reply('That did not seem like a valid regular expression')
	}

	await replyMenuToContext(menu, context, `/list/:i${context.session.currentMissionIndex}/replacers/add/`)
})

bot.use(regexQuestion.middleware())

menu.interact('Set the Regular Expression…', 'regex', {
	do: async context => {
		context.session.currentMissionIndex = getMissionIndex(context)
		await Promise.all([
			regexQuestion.replyWithMarkdown(context, 'Please tell me the regexp you wanna use.'),
			context.deleteMessage().catch(() => {/* ignore */})
		])
	}
})

const regexFlags = {
	g: 'global',
	i: 'ignore case',
	m: 'multiline',
	u: 'unicode'
}

menu.select('flags', regexFlags, {
	columns: 2,
	multiselect: true,
	isSet: (context, key) => (context.session.replacerRegexFlags ?? DEFAULT_FLAGS).includes(key),
	set: (context, key, newState) => {
		if (!key) {
			return
		}

		const old = context.session.replacerRegexFlags ?? DEFAULT_FLAGS
		const set = new Set([...old])
		if (newState) {
			set.add(key)
		} else {
			set.delete(key)
		}

		context.session.replacerRegexFlags = [...set]
			.sort((a, b) => a.localeCompare(b))
			.join('')
	}
})

const replaceValueQuestion = new TelegrafStatelessQuestion<Context>('replacer-replace-value', async context => {
	if (context.session.currentMissionIndex === undefined || !Number.isFinite(context.session.currentMissionIndex)) {
		return lostTrack(context)
	}

	// TODO: find a way to send 'empty'
	const replaceValue = context.message.text
	context.session.replacerReplaceValue = replaceValue
	await replyMenuToContext(menu, context, `/list/:i${context.session.currentMissionIndex}/replacers/add/`)
})

bot.use(replaceValueQuestion.middleware())

menu.interact('Set the replaceValue…', 'replaceValue', {
	hide: context => !context.session.replacerRegexSource,
	do: async context => {
		context.session.currentMissionIndex = getMissionIndex(context)
		await Promise.all([
			replaceValueQuestion.replyWithMarkdown(context, 'Please tell me the replaceValue you wanna use.'),
			context.deleteMessage().catch(() => {/* ignore */})
		])
	}
})

menu.interact('Reset', 'reset', {
	hide: context => context.session.replacerRegexSource === undefined &&
		context.session.replacerRegexFlags === undefined &&
		context.session.replacerReplaceValue === undefined,
	do: async (context, next) => {
		delete context.session.replacerRegexSource
		delete context.session.replacerRegexFlags
		delete context.session.replacerReplaceValue
		return next()
	}

})

menu.interact('Add', 'add', {
	joinLastRow: true,
	hide: context => !context.session.replacerRegexSource,
	do: async (context, next) => {
		if (!context.session.replacerRegexSource) {
			await context.answerCbQuery('you need to specify a source')
			return
		}

		const source = context.session.replacerRegexSource
		const flags = context.session.replacerRegexFlags ?? DEFAULT_FLAGS
		const replaceValue = context.session.replacerReplaceValue ?? DEFAULT_REPLACE_VALUE

		const index = getMissionIndex(context)
		const issuer = `tg${context.from!.id}`
		const mission = userMissions.getByIndex(issuer, index)

		const newReplacers: ContentReplace[] = [
			...(mission.contentReplace ?? []),
			{source, flags, replaceValue}
		]

		userMissions.update(issuer, {...mission, contentReplace: newReplacers})

		delete context.session.replacerRegexSource
		delete context.session.replacerRegexFlags
		delete context.session.replacerReplaceValue

		await Promise.all([
			context.answerCbQuery('added successfully 😎'),
			next()
		])
	}
})

menu.manualRow(backButtons)

function menuBody(context: Context, path: string): Body {
	let text = ''

	const index = Number(/:i(\d+)/.exec(path)![1])
	const issuer = `tg${context.from!.id}`
	const mission = userMissions.getByIndex(issuer, index)
	text += basicInfo(format, mission)
	text += '\n'

	const {replacerRegexSource: source, replacerRegexFlags: flags, replacerReplaceValue: replaceValue} = context.session

	if (source) {
		const regex = '/' + source + '/' + (flags ?? DEFAULT_FLAGS)
		text += format.bold('Regular Expression')
		text += ':\n'
		text += format.monospaceBlock(regex, 'js')
		text += '\n'

		text += format.bold('Replace with')
		text += ': '
		text += format.monospace(replaceValue ?? DEFAULT_REPLACE_VALUE)
		text += '\n'

		text += '\n'
		text += 'this basically results in the JavaScript equivalent of'
		text += '\n'

		const js = `content.replace(/${source}/${flags ?? DEFAULT_FLAGS}, '${replaceValue ?? DEFAULT_REPLACE_VALUE}')`
		text += format.monospaceBlock(js, 'js')
		text += '\n'
	}

	return {text, parse_mode: format.parse_mode}
}