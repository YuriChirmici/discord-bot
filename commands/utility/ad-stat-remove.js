const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	ButtonBuilder,
	ActionRowBuilder,
	ButtonStyle
} = require("discord.js");
const adService = require("../../services/ad");
const { commandsPermission } = require("../../config.json");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.setDescription("Очищает статистику")
		.setDefaultMemberPermissions(PermissionFlagsBits[commandsPermission])
		.setDMPermission(false),

	async execute(interaction) {
		const customId = `${NAME}_confirm`;
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
			await adService.clearStats();
			await interaction.reply({
				content: "Статистика очищена!",
				ephemeral: true
			});
		}
	}
};
