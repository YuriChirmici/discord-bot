const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const adService = require("../../services/ad");
const configService = require("../../services/config");
const { Models } = require("../../database");
const { createButtons, createSelect, getButtonsFlat } = require("../../services/helpers");
const customIdService = require("../../services/custom-id-service");
const formsService = require("../../services/formsService");

const NAME = getCommandName(__filename);

const createAd = (title, content) => {
	let ad = new EmbedBuilder()
		.setColor(configService.adsConfig.borderColor);

	if (content) {
		ad = ad.setDescription(content);
	}

	if (title) {
		ad = ad.setTitle(title);
	}

	return ad;
};

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription(`Создает объявление. Типы: ${configService.adsConfig.ads.map(({ name }) => name).join(", ")}`)
			.addStringOption(option => option.setName("name").setDescription("Название объявления").setRequired(true).addChoices(
				...configService.adsConfig.ads.map(({ name }) => ({ name, value: name }))
			))
			.addChannelOption(option => option.setName("channel").setDescription("Целевой канал"))
			.addIntegerOption(option => option.setName("timer").setDescription("Таймер для удаления объявления (минуты)"))
			.addStringOption(option => option.setName("title").setDescription("Заголовок эмбеда"))
			.addStringOption(option => option.setName("text").setDescription("Текст эмбеда"))
			.addStringOption(option => option.setName("date").setDescription("Дата"))
			.addStringOption(option => option.setName("time").setDescription("Время"))
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.commandsPermission])
			.setDMPermission(false);
	},

	async execute({ interaction, client }) {
		const adName = interaction.options.getString("name");
		const adConfig = adService.getAdConfigByName(adName);
		const creationFuncName = `createAd_${adConfig?.type}`;
		if (!this[creationFuncName]) {
			return await interaction.reply("Неверные название или тип объявления");
		}

		const { channelId, timer, title, text, content } = this.getCommandOptions(interaction);

		const messageProps = await this.createAdMessage({ title, text, content }, adConfig);
		const targetChannel = await this._prepareTargetChannel(client, channelId);

		await this[creationFuncName](interaction, client, { messageProps, targetChannel, timer });
	},

	getCommandOptions(interaction) {
		const adName = interaction.options.getString("name");
		const adConfig = adService.getAdConfigByName(adName);
		const defaults = adConfig.defaults || {};

		const channelId = interaction.options.getChannel("channel")?.id || defaults.channelId || interaction.channel.id;
		const timer = interaction.options.getInteger("timer") || defaults.timer || 24 * 60;
		const title = interaction.options.getString("title") || defaults.title || "";
		const text = interaction.options.getString("text") || defaults.text || "";
		let content = defaults.content || "";

		if (adName === adService.attendanceConfigName) {
			const date = interaction.options.getString("date") || adService.getDefaultDate();
			const time = interaction.options.getString("time") || defaults.time || "";
			const rating = adService.getRatingByDate(date) || "";
			content = content
				.replaceAll("{{date}}", date)
				.replaceAll("{{time}}", time)
				.replaceAll("{{rating}}", rating);
		}

		return { adName, channelId, timer, title, text, content };
	},

	async createAdMessage({ title, text, content }, adConfig) {
		const ad = createAd(title, content);
		let components = [];
		const customIdData = { commandName: NAME, data: { adName: adConfig.name } };
		if (adConfig.select) {
			let select = adConfig.select;
			if (adConfig.name === adService.commandsConfigName) {
				select = this.getCommandsSelect(adConfig);
			}

			const customId = await customIdService.createCustomId(customIdData);
			components.push(createSelect(customId, select));
		}

		if (adConfig.buttons?.length) {
			const buttons = await createButtons(adConfig.buttons, customIdData);
			components.push(...buttons);
		}

		return {
			embeds: [ ad ],
			components,
			content: text
		};
	},

	async createAd_attendance(interaction, client, { messageProps, targetChannel, timer }) {
		const task = await Models.Scheduler.findOne({ name: adService.deletionTaskName });
		if (task) {
			await interaction.reply("Объявление будет создано после очистки предыдущего.");
		} else {
			await interaction.deferReply();
			await interaction.deleteReply();
		}

		await adService.processRatingRolesUpdate(interaction);
		await adService.runAdDeletionTasks(client);

		const adMessage = await targetChannel.send(messageProps);

		await adService.addDelayedDeletion({
			guildId: interaction.guild.id,
			messageId: adMessage.id,
			channelId: adMessage.channel.id
		}, Date.now() + timer * 60 * 1000);
	},

	async createAd_rolesUsual(interaction, client, { messageProps, targetChannel }) {
		await interaction.deferReply();
		await interaction.deleteReply();
		await targetChannel.send(messageProps);
	},

	async createAd_memberCommands(interaction, client, { messageProps, targetChannel }) {
		await interaction.deferReply();
		await interaction.deleteReply();
		await targetChannel.send(messageProps);
	},

	getCommandsSelect(adConfig) {
		const commands = configService.memberCommands.filter(({ hideInAd }) => !hideInAd);
		const select = {
			...adConfig.select,
			options: commands.map((command) => ({
				...(command.optionData || {}),
				value: command.name
			}))
		};

		return select;
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

	async buttonClick({ interaction }) {
		if (!interaction.customData) {
			return;
		}

		const { adName } = interaction.customData;
		const buttonIndex = +interaction.customData.index;

		const adConfig = adService.getAdConfigByName(adName);
		if (!adConfig) {
			return;
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

	async stringSelect({ interaction, client }) {
		const { adName } = interaction.customData;
		const adConfig = adService.getAdConfigByName(adName);
		if (!adConfig) {
			return;
		}

		if (adName === adService.commandsConfigName) {
			await this.onCommandSelect({ interaction, client });
		}
	},

	async onCommandSelect({ interaction, client }) {
		const memberCommand = interaction.values?.[0];
		const command = configService.memberCommands.find((c) => c.name === memberCommand);
		if (command.type === "form") {
			const oldForm = await formsService.getIncompleteForm(interaction.member.id, memberCommand);
			if (oldForm) {
				await interaction.reply({
					content: `Заявка уже создана, перейдите в ветку <#${oldForm.channelId}>`,
					ephemeral: true
				});
				return;
			}

			const { channel } = await formsService.startForm(interaction.member, client, memberCommand);

			await interaction.reply({
				content: `Заявка создана, перейдите в ветку <#${channel.id}>`,
				ephemeral: true
			});
		}
	},

	async task(data, client) {
		await adService.closeAd(data, client);
	}
};
