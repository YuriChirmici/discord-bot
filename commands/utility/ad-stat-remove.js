const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	ButtonBuilder,
	ActionRowBuilder,
	ButtonStyle
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
		const customId = `${NAME}_confirm`
		const confirm = new ButtonBuilder()
			.setCustomId(customId)
			.setStyle(ButtonStyle.Danger)
			.setLabel("Подтвердить");

		const row = new ActionRowBuilder()
			.addComponents(confirm);

		await interaction.reply({
			components: [ row ],
			ephemeral: true
		});
	},

	async buttonClick(interaction) {
		const subcommand = interaction.customId.split("_")[1];
		if (subcommand === "confirm") {
			await AdService.clearStats();
			await interaction.reply({
				content: "Статистика очищена!",
				ephemeral: true
			});
		}
	}
};