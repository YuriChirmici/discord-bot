const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	ActionRowBuilder,
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle
} = require("discord.js");

const { ad: adConfig } = require("../../config.json");

const NAME = "ad";

const createButton = (id, emoji, style = ButtonStyle.Secondary) => {
	const customId = `${NAME}_emoji${id}`
	const button = new ButtonBuilder()
		.setCustomId(customId)
		.setStyle(style)
		.setEmoji(emoji);
		
	return button;
};

module.exports = {
	name: NAME,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.setDescription("Создает объявление. <Заголовок объявления> <Текст объявления> <Время в минутах>")
		.addStringOption((option) =>
			option.setName("header")
				.setDescription("Заголовок объявления")
				.setRequired(true)
		)
		.addStringOption((option) =>
			option.setName("text")
				.setDescription("Текст объявления")
				.setRequired(true)
		)
		.addIntegerOption((option) =>
			option.setName("time")
				.setDescription("Время в минутах")
				.setRequired(true)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
		.setDMPermission(false),

	async execute(interaction) {
		const header = interaction.options.getString("header");
		const text = interaction.options.getString("text");
		// const time = interaction.options.getInteger("time");

		const buttons = [];
		for (let i = 0; i < adConfig.roles.length; i++) {
			buttons.push(createButton(i, adConfig.roles[i].emoji))
		}

		const row = new ActionRowBuilder()
			.addComponents(...buttons);

		const ad = createAd(header, text);
		
		const channel = interaction.member.guild.channels.cache.find(c => c.id === interaction.channelId)

		await channel.send({
			embeds: [ad],
			components: [row]
		});
		await interaction.reply({ content: "Объявление создано!", ephemeral: true });
	},

	async buttonClick(interaction) {
		const roleNum = interaction.customId[interaction.customId.length - 1];
		const roleName = adConfig.roles[+roleNum].name;
		const role = interaction.member.guild.roles.cache.find(r => r.name == roleName);

		const roleCleared = await setRole(role, interaction.member);
		const message = roleCleared ? "Роль очищена" : "Роль изменена на " + roleName;

		await interaction.reply({
			content: message,
			ephemeral: true
		});
	}
};

const createAd = (title, text) => {
	const ad = new EmbedBuilder()
		.setColor(adConfig.color)
		.setTitle(title)
		.setDescription(text)

	return ad;
}

const setRole = async (newRole, member) => {
	let roleCleared = false;
	const promises = [];

	for (let role of adConfig.roles) {
		const userRole = member.roles.cache.find(r => r.name === role.name);

		if (role.name !== newRole.name) {
			if (userRole) {
				promises.push(member.roles.remove(userRole));
			}
			
			continue;
		}

		if (userRole) {
			promises.push(member.roles.remove(userRole));
			roleCleared = true;
		} else {
			promises.push(member.roles.add(newRole));
		}
	}

	await Promise.all(promises);

	return roleCleared;
}