import { ApplicationCommandData, Client as DiscordClient } from 'discord.js'
import { discord } from './index'
import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v9'
import { DiscordConfig } from './discord-bot'

enum ApplicationCommandOptionTypes {
  SUB_COMMAND = 1,
  SUB_COMMAND_GROUP = 2,
  STRING = 3,
  INTEGER = 4,
  BOOLEAN = 5,
  USER = 6,
  CHANNEL = 7,
  ROLE = 8,
  MENTIONABLE = 9,
  NUMBER = 10,
}

export async function onReady(config: DiscordConfig, client: DiscordClient) {
	const data: ApplicationCommandData[] = [
		{
			name: 'approve',
			description: 'Approve the existing translation of a bug.',
			options: [{
				name: 'id',
				type: ApplicationCommandOptionTypes.STRING,
				description: 'The ticket key.',
				required: true,
			}]
		},
		{
			name: 'as',
			description: 'Translate as someone.',
			options: [
				{
					name: 'user',
					type: ApplicationCommandOptionTypes.USER,
					description: 'The user.',
					required: true,
				},
				{
					name: 'content',
					type: ApplicationCommandOptionTypes.STRING,
					description: 'The ticket ID and translated summary with the same format as your translation message.',
					required: true,
				}
			],
		},
		{
			name: 'backup',
			description: 'Back up the bug cache and color cache.',
		},
		{
			name: 'color',
			description: 'Operate 色图.',
			options: [
				{
					name: 'clear',
					type: ApplicationCommandOptionTypes.SUB_COMMAND,
					description: 'Clear the color of someone.',
					options: [{
						name: 'user',
						type: ApplicationCommandOptionTypes.USER,
						description: 'The user.',
						required: true,
					}],
				},
				{
					name: 'get',
					type: ApplicationCommandOptionTypes.SUB_COMMAND,
					description: 'Get the color of someone.',
					options: [{
						name: 'user',
						type: ApplicationCommandOptionTypes.USER,
						description: 'The user.',
						required: true,
					}],
				},
				{
					name: 'set',
					type: ApplicationCommandOptionTypes.SUB_COMMAND,
					description: 'Set the color of yourself or someone else.',
					options: [
						{
							name: 'value',
							type: ApplicationCommandOptionTypes.STRING,
							description: 'A hexadecimal representation of the color.',
							required: true,
						},
						{
							name: 'user',
							type: ApplicationCommandOptionTypes.USER,
							description: 'The user. Defaults to yourself.',
							required: false,
						}
					],
				},
			],
		},
		{
			name: 'ping',
			description: 'Ping-pong!',
		},
		{
			name: 'query',
			description: 'Query all fixed, untranslated bugs.',
			options: [{
				name: 'jql',
				type: ApplicationCommandOptionTypes.STRING,
				description: 'An optional JQL query.',
			}],
		},
	]
	const rest = new REST({ version: '9' }).setToken(discord!.token);
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationGuildCommands(discord!.appId, discord!.guild),
			{ body: data.toString() },
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}

	// if (config.roles?.length) {
	// 	data.push({
	// 		name: 'join',
	// 		description: 'Join a role.',
	// 		options: config.roles.map(r => ({
	// 			name: r.name,
	// 			type: ApplicationCommandOptionTypes.SUB_COMMAND,
	// 			description: `Join the role ${r.name}`,
	// 		}))
	// 	})
	// }

	try {
		await client.guilds.cache.get(config.guild)?.commands.set(data)
	} catch (e) {
		console.error('[Discord#onReady] ', e)
	}
}
