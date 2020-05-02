import {Composer} from 'telegraf'

import * as users from '../lib/users'

export const bot = new Composer()

bot.action(/adduser:(\d+)/, async ctx => {
	const userID = Number(ctx.match![1])
	await users.addUser(userID, false)
	await ctx.telegram.sendMessage(userID, 'You can now use this bot!\nUse /help for more info how to use it.')
	return ctx.answerCbQuery('User added')
})
