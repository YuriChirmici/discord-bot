const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const formsService = require("../../services/formsService");

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

	async execute({ interaction, client }) {
		await formsService.startForm(interaction.member, client, "auth");
		await interaction.reply({ content: "Тестовая авторизация начата", ephemeral: true });
	},
};
