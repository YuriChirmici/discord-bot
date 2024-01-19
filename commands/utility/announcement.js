const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle
} = require("discord.js");

const { adRoles: roles } = require("../../config.json");

const name = "ad";

const createButton = (id, emoji, style = ButtonStyle.Secondary) => {
	const customId = `${name}_emoji${id}`
	const button = new ButtonBuilder()
		.setCustomId(customId)
		.setStyle(style)
		.setEmoji(emoji);
		
	return button;
};

module.exports = {
	name,
	data: new SlashCommandBuilder()
		.setName(name)
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
		for (let i = 0; i < roles.length; i++) {
			buttons.push(createButton(i, roles[i].emoji))
		}

		const row = new ActionRowBuilder()
			.addComponents(...buttons);

		await interaction.reply({
			content: `${header}\n${text}`,
			components: [row],
		});
	},

	async buttonClick(interaction) {
		const roleNum = interaction.customId[interaction.customId.length - 1];
		const roleName = roles[+roleNum].name;
		const role = interaction.member.guild.roles.cache.find(r => r.name == roleName);

		const roleCleared = await setRole(role, interaction.member);
		const message = roleCleared ? "Роль очищена" : "Роль изменена на " + roleName;

		await interaction.reply({
			content: message,
			ephemeral: true
		});
	}
};

const setRole = async (newRole, member) => {
	let roleCleared = false;
	const promises = [];

	for (let role of roles) {
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