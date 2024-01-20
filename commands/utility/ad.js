const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	ActionRowBuilder,
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle
} = require("discord.js");
const AdService = require("../../services/ad");
const { ad: adConfig } = require("../../config.json");

const NAME = "ad";

const createButton = (id, emoji, style = ButtonStyle.Secondary) => {
	const customId = `${NAME}_role${id}`
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
		.setDescription(text)

	return ad;
}

module.exports = {
	name: NAME,
	isCustomCommand: true,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.setDescription(
			`Используй !${NAME}. Создает объявление. !ad {Заголовок} {Время в минутах} {текст (optional)} {содержание}`
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDMPermission(false),

	async execute(message) {
		if (!message.customArgs) {
			await message.channel.send("Используй команду с !");
		}

		if (message.customArgs.length < 3) {
			await message.channel.send("Неправильные аргументы");
		}

		const header = message.customArgs[0] || "";
		const time = Number.parseInt(message.customArgs[1]);
		let text = message.customArgs[2] || "";
		let content = "";
		if (message.customArgs.length === 4) {
			content = text;
			text = message.customArgs[3]
		}

		const buttons = [];
		for (let i = 0; i < adConfig.roles.length; i++) {
			buttons.push(createButton(i, adConfig.roles[i].emoji))
		}

		const row = new ActionRowBuilder()
			.addComponents(...buttons);

		const ad = createAd(header, text);
		
		await AdService.clearDelayedDeletions();
		const taskDate = Date.now() + time * 60 * 1000;
		await AdService.addDelayedDeletion({ guildId: message.guildId }, taskDate, NAME);

		await message.channel.send({
			embeds: [ad],
			components: [row],
			content
		});
	},

	async buttonClick(interaction) {
		const roleNum = interaction.customId[interaction.customId.length - 1];
		const roleName = adConfig.roles[+roleNum].name;
		const role = interaction.member.guild.roles.cache.find(r => r.name == roleName);

		const roleCleared = await AdService.changeRole(role, interaction.member);
		const message = roleCleared ? "Роль очищена" : "Роль изменена на " + roleName;

		await interaction.reply({
			content: message,
			ephemeral: true
		});
	},

	async task(data, client) {
		const guild = await client.guilds.fetch(data.guildId);
		await AdService.deleteAdRoles(guild);
	}
};
