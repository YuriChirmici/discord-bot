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

module.exports = {
	name: NAME,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.setDescription(
			`Используй !${NAME}. Создает объявление. !ad {Заголовок} {Время в минутах} {текст (optional)} {содержание}`
		)
		.setDefaultMemberPermissions(PermissionFlagsBits[commandsPermission])
		.setDMPermission(false),

	async execute(message, client) {
		if (!message.customArgs) {
			await message.reply("Используй команду с !");
			return;
		}

		if (message.customArgs.length < 3) {
			await message.reply("Неправильные аргументы");
			return;
		}

		const header = message.customArgs[0] || "";
		const time = Number.parseInt(message.customArgs[1]);
		let text = message.customArgs[2] || "";
		let content = "";
		if (message.customArgs.length === 4) {
			content = text;
			text = message.customArgs[3];
		}

		const buttons = [];
		for (let i = 0; i < adConfig.roles.length; i++) {
			buttons.push(createButton(i, adConfig.roles[i].emoji));
		}

		const row = new ActionRowBuilder()
			.addComponents(...buttons);

		const ad = createAd(header, text);

		const adMessage = await message.channel.send({
			embeds: [ ad ],
			components: [ row ],
			content
		});

		await this._addSchedulerTask({
			taskDate: Date.now() + time * 60 * 1000,
			guildId: message.guildId,
			messageId: adMessage.id,
			channelId: adMessage.channel.id
		}, client);
	},

	async _addSchedulerTask({ taskDate, guildId, messageId, channelId }, client) {
		await adService.runAdDeletionTasks(client);
		await adService.addDelayedDeletion({ guildId, messageId, channelId }, taskDate);
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
