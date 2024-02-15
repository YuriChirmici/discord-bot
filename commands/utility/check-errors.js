const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const { commandsPermission } = require("../../config.json");

const NAME = "check-errors";

module.exports = {
	name: NAME,
	isCustomCommand: true,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.addStringOption(option => option.setName("count").setDescription("Количество").setRequired(false))
		.setDescription("Возвращает последние ошибки")
		.setDefaultMemberPermissions(PermissionFlagsBits[commandsPermission])
		.setDMPermission(false),

	async execute(interaction) {
		const count = interaction.options.getString("count") || 1;
		const content = (getLastErrors(count) || "Пусто").substr(0, 1999);
		await interaction.reply({ content, ephemeral: true });
	},
};
