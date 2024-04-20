const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const path = require("path");
const authFlowService = require("../../services/auth-flow");

const NAME = path.basename(__filename).split(".")[0];

module.exports = {
	name: NAME,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.setDescription("Тест авторизации")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDMPermission(false),

	async execute(interaction, client) {
		await authFlowService.startFlow(interaction.member, client);
		await interaction.reply({ content: "Тестовая авторизация начата", ephemeral: true });
	},
};
