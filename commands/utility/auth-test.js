const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const authFlowService = require("../../services/auth-flow");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription("Тест авторизации")
			.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
			.setDMPermission(false);
	},

	async execute(interaction, client) {
		await authFlowService.startFlow(interaction.member, client);
		await interaction.reply({ content: "Тестовая авторизация начата", ephemeral: true });
	},
};
