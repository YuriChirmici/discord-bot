const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	ActionRowBuilder,
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle
} = require("discord.js");
const adService = require("../../services/ad");
const { ad: adConfig, commandsPermission } = require("../../config.json");
const { Models } = require("../../database");

const NAME = getCommandName(__filename);

const createButton = (id, emoji, style = ButtonStyle.Secondary) => {
	const customId = `${NAME}_role${id}`;
	const button = new ButtonBuilder()
		.setCustomId(customId)
		.setStyle(style)
		.setEmoji(emoji);

	return button;
};

const createAd = (title, text) => {
	const ad = new EmbedBuilder()
		.setColor(adConfig.color)
		.setTitle(title)
		.setDescription(text);

	return ad;
};

const customArgs = {
	title: { required: true },
	timer: { required: true, type: "number" },
	text: {},
	content: { required: true },
	channelId: {},
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
			return await message.reply("Используй команду !" + NAME);
		}

		const { title = "", text = "", content = "", channelId } = message.customArgs;
		const timer = Number.parseInt(message.customArgs.timer);
		const ad = createAd(title, text);
		const buttons = adConfig.roles.map((role, i) => createButton(i, role.emoji));
		const buttonsRow = new ActionRowBuilder()
			.addComponents(...buttons);

		const task = await Models.Scheduler.findOne({ name: adService.deletionTaskName });
		if (task) {
			await message.channel.send("Объявление будет создано после очистки предыдущего.");
		}

		await adService.runAdDeletionTasks(client);
		const targetChannel = (await this._prepareTargetChannel(client, channelId)) || message.channel;
		const adMessage = await targetChannel.send({
			embeds: [ ad ],
			components: [ buttonsRow ],
			content
		});

		await adService.addDelayedDeletion({
			guildId: message.guildId,
			messageId: adMessage.id,
			channelId: adMessage.channel.id
		}, Date.now() + timer * 60 * 1000);
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
		const member = interaction.member;
		const roleIndex = +interaction.customId[interaction.customId.length - 1];
		const configRole = adConfig.roles[+roleIndex];
		const role = member.guild.roles.cache.find(r => r.id == configRole.id);

		const roleCleared = await adService.changeRole(role, member);
		const message = roleCleared ? `Роль '${role.name}' очищена` : `Роль изменена на '${role.name}'`;

		await interaction.reply({
			content: message,
			ephemeral: true
		});
	},

	async task(data, client) {
		await adService.closeAd(data, client);
	}
};
