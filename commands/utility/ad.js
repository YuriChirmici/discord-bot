const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const adService = require("../../services/ad");
const { adsConfig, commandsPermission } = require("../../config.json");
const { Models } = require("../../database");
const { createButtons, getButtonsFlat } = require("../../services/helpers");

const NAME = getCommandName(__filename);

const createAd = (title, content) => {
	const ad = new EmbedBuilder()
		.setColor(adsConfig.borderColor)
		.setTitle(title)
		.setDescription(content);

	return ad;
};

const customArgs = {
	title: { required: true },
	text: {},
	content: { required: true },
	channelId: {},
	name: { required: true }
};

module.exports = {
	name: NAME,
	customArgs,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.setDescription(
			`Используй !${NAME}. Создает объявление. Параметры: ${Object.keys(customArgs).join(", ")}`
		)
		.setDefaultMemberPermissions(PermissionFlagsBits[commandsPermission])
		.setDMPermission(false),

	async execute(message, client) {
		if (!message.customArgs) {
			return await message.channel.send("Используй команду !" + NAME);
		}

		const adName = message.customArgs.name;
		const adConfig = adService.getAdConfigByName(adName);
		const creationFuncName = `createAd_${adConfig.type}`;
		if (!this[creationFuncName]) {
			return await message.channel.send("Неверные имя или тип объявления");
		}

		const { channelId } = message.customArgs;
		const messageProps = this.createAdMessage(message, adConfig);
		const targetChannel = (await this._prepareTargetChannel(client, channelId)) || message.channel;

		await this[creationFuncName](message, client, { messageProps, targetChannel });
	},

	createAdMessage(message, adConfig) {
		const { title = "", text = "", content = "" } = message.customArgs;
		const ad = createAd(title, content);

		const components = createButtons(adConfig.buttons, { prefix: NAME }, { adName: adConfig.name });

		return {
			embeds: [ ad ],
			components,
			content: text
		};
	},

	async createAd_attendance(message, client, { messageProps, targetChannel }) {
		const timer = Number.parseInt(message.customArgs.timer);
		if (!timer) {
			return await message.channel.send("Отсутвтуют обязательные параметры: timer");
		}

		const task = await Models.Scheduler.findOne({ name: adService.deletionTaskName });
		if (task) {
			await message.channel.send("Объявление будет создано после очистки предыдущего.");
		}

		await adService.runAdDeletionTasks(client);

		const adMessage = await targetChannel.send(messageProps);

		await adService.addDelayedDeletion({
			guildId: message.guildId,
			messageId: adMessage.id,
			channelId: adMessage.channel.id
		}, Date.now() + timer * 60 * 1000);
	},

	async createAd_rolesUsual(message, client, { messageProps, targetChannel }) {
		await targetChannel.send(messageProps);
	},

	async _prepareTargetChannel(client, channelId) {
		if (!channelId) {
			return;
		}

		try {
			return await client.channels.fetch(channelId);
		} catch (err) {
			if (err.message !== "Unknown Channel") {
				logError(err);
			}
		}
	},

	async buttonClick(interaction) {
		if (!interaction.customData) {
			return;
		}

		const { adName } = interaction.customData;
		const buttonIndex = +interaction.customData.index;

		const adConfig = adService.getAdConfigByName(adName);
		if (!adConfig) {
			return logError("No defined config for " + adName);
		}

		const buttonConfig = getButtonsFlat(adConfig.buttons)[buttonIndex];
		const member = interaction.member;

		const rolesCleared = await adService.changeRoleButton({ member, adConfig, buttonIndex });

		const guildRoles = await member.guild.roles.fetch();
		const roles = Array.from(guildRoles.filter(({ id }) => buttonConfig.rolesAdd.includes(id)).values());
		let message = this._prepareButtonReply(roles, adConfig, rolesCleared);

		await interaction.reply({
			content: message,
			ephemeral: true
		});

		if (adConfig.resultChannelId) {
			const channel = await interaction.guild.channels.fetch(adConfig.resultChannelId);
			const resultMessage = `<@${member.user.id}>: ${message}`;
			await await channel.send(resultMessage);
		}
	},

	_prepareButtonReply(roles, adConfig, rolesCleared) {
		const rolesString = roles.map(({ id }) => `<@&${id}>`).join(", ");
		let message;
		if (rolesCleared) {
			if (roles.length > 1) {
				message = `Роли "${rolesString}" очищены`;
			} else {
				message = `Роль "${rolesString}" очищена`;
			}
		} else if (adConfig.multipleRoles) {
			if (roles.length > 1) {
				message = `Роли "${rolesString}" добавлены`;
			} else {
				message = `Роль "${rolesString}" добавленa`;
			}
		} else {
			if (roles.length > 1) {
				message = `Роли изменены на "${rolesString}"`;
			} else {
				message = `Роль изменена на "${rolesString}"`;
			}
		}

		return message;
	},

	async task(data, client) {
		await adService.closeAd(data, client);
	}
};
