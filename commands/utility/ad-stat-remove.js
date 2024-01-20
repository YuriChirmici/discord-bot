const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const AdService = require("../../services/ad");

const NAME = "ad-stat-remove";

module.exports = {
	name: NAME,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.setDescription("Очищает статистику")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDMPermission(false),

	async execute(interaction) {
		await AdService.clearStats();
		await interaction.reply({ content: "Статистика очищена!", ephemeral: true });
	}
};