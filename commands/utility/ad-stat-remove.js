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
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
		.setDMPermission(false),

	async execute(interaction) {
		AdService.clearStats();
		await interaction.reply({ content: "Статистика очищена!", ephemeral: true });
	}
};