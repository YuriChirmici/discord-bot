const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const adService = require("../../services/ad");
const configService = require("../../services/config");
const { Models } = require("../../database");
const { createButtons, createSelect, getButtonsFlat, createEmbed } = require("../../services/helpers");
const customIdService = require("../../services/custom-id");
const memberCommandsService = require("../../services/member-commands");
const localizationService = require("../../services/localization");

const local = localizationService.getLocal();
const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription(local.adCommandDesc.replace("{{types}}", configService.adsConfig.ads.map(({ name }) => name).join(", ")))
			.addStringOption(option => option.setName("name").setDescription(local.adNameParamDesc).setRequired(true).addChoices(
				...configService.adsConfig.ads.map(({ name }) => ({ name, value: name }))
			))
			.addChannelOption(option => option.setName("channel").setDescription(local.adChannelParamDesc))
			.addIntegerOption(option => option.setName("timer").setDescription(local.adTimerParamDesc))
			.addStringOption(option => option.setName("title").setDescription(local.adTitleParamDesc))
			.addStringOption(option => option.setName("text").setDescription(local.adTextParamDesc))
			.addStringOption(option => option.setName("date").setDescription(local.adDateParamDesc))
			.addStringOption(option => option.setName("time").setDescription(local.adTimeParamDesc))
			.addBooleanOption(option => option.setName("clear_roles").setDescription(local.adClearRolesParamDesc))
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.commandsPermission])
			.setDMPermission(false);
	},

	async execute({ interaction, client }) {
		const adName = interaction.options.getString("name");
		const adConfig = adService.getAdConfigByName(adName);
		const creationFuncName = `createAd_${adConfig?.type}`;
		if (!this[creationFuncName]) {
			return await interaction.reply(local.adWrongTypeErr);
		}

		const { channelId, timer, title, text, content, clearRoles } = this.getCommandOptions(interaction);

		const messageProps = await this.createAdMessage({ title, text, content }, adConfig);
		const targetChannel = await this._prepareTargetChannel(client, channelId);

		await this[creationFuncName](interaction, client, { messageProps, targetChannel, timer, clearRoles });
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
		let clearRoles;

		if (adName === adService.attendanceConfigName) {
			const date = interaction.options.getString("date") || adService.getDefaultDate();
			const time = interaction.options.getString("time") || defaults.time || "";
			const rating = adService.getRatingByDate(date) || "";
			content = content
				.replaceAll("{{date}}", date)
				.replaceAll("{{time}}", time)
				.replaceAll("{{rating}}", rating);

			clearRoles = this._shouldClearRoles(interaction, adConfig);
		}

		return { adName, channelId, timer, title, text, content, clearRoles };
	},

	_shouldClearRoles(interaction, adConfig) {
		const defaults = adConfig.defaults || {};
		const clearRoles = interaction.options.getBoolean("clear_roles");
		if (typeof clearRoles === "boolean") {
			return clearRoles;
		}

		if (typeof defaults.clear_roles === "boolean") {
			return defaults.clear_roles;
		}

		return true;
	},

	async createAdMessage({ title, text, content }, adConfig) {
		const embed = createEmbed({ description: content, title });
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
			embeds: [ embed ],
			components,
			content: text
		};
	},

	async createAd_attendance(interaction, client, { messageProps, targetChannel, timer, clearRoles }) {
		const task = await Models.Scheduler.findOne({ name: adService.deletionTaskName });
		if (task) {
			await interaction.reply(local.adAttendanceReply);
		} else {
			await interaction.deferReply({ ephemeral: true });
			await interaction.deleteReply();
		}

		await adService.processRatingRolesUpdate(interaction);
		await adService.runAdDeletionTasks(client, { withoutRolesClear: !clearRoles });

		const adMessage = await targetChannel.send(messageProps);

		await adService.addDelayedDeletion({
			guildId: interaction.guild.id,
			messageId: adMessage.id,
			channelId: adMessage.channel.id
		}, Date.now() + timer * 60 * 1000);
	},

	async createAd_rolesUsual(interaction, client, { messageProps, targetChannel }) {
		await interaction.deferReply({ ephemeral: true });
		await interaction.deleteReply();
		await targetChannel.send(messageProps);
	},

	async createAd_memberCommands(interaction, client, { messageProps, targetChannel }) {
		await interaction.deferReply({ ephemeral: true });
		await interaction.deleteReply();
		await targetChannel.send(messageProps);
	},

	getCommandsSelect(adConfig) {
		const commands = configService.memberCommands.filter(({ hideInAd }) => !hideInAd);
		const select = {
			...adConfig.select,
			options: [
				...commands.map((command) => ({
					...(command.optionData || {}),
					value: command.name
				})),
				{
					text: local.memberCommandsClearChoice,
					value: memberCommandsService.clearSelectOptionValue
				},
			]
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
				message = local.rolesRemoved;
			} else {
				message = local.roleRemoved;
			}
		} else if (adConfig.multipleRoles) {
			if (roles.length > 1) {
				message = local.rolesAdded;
			} else {
				message = local.roleAdded;
			}
		} else {
			if (roles.length > 1) {
				message = local.rolesChanged;
			} else {
				message = local.roleChanged;
			}
		}

		message = message.replace("{{role}}", rolesString);

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
		if (memberCommand === memberCommandsService.clearSelectOptionValue) {
			await interaction.deferReply({ ephemeral: true });
			await interaction.deleteReply();
			return;
		}

		await memberCommandsService.executeCommand({ interaction, client, commandName: memberCommand });
	},

	async task(data, client) {
		await adService.closeAd(data, client);
	}
};
