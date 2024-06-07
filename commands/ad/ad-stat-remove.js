const {	SlashCommandBuilder, PermissionFlagsBits, ButtonStyle } = require("discord.js");
const adService = require("../../services/ad");
const configService = require("../../services/config");
const { createButtons } = require("../../services/helpers");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription("Очищает статистику")
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.commandsPermission])
			.setDMPermission(false);
	},

	async execute(interaction) {
		const buttonsConfig = [ [ {
			style: ButtonStyle.Danger,
			text: "Подтвердить"
		} ] ];
		const components = createButtons(buttonsConfig, { prefix: NAME }, { action: "confirm" });

		await interaction.reply({
			components,
			ephemeral: true
		});
	},

	async buttonClick(interaction) {
		const { action } = interaction.customData;
		if (action === "confirm") {
			await adService.clearStats();
			await interaction.reply({
				content: "Статистика очищена!",
				ephemeral: true
			});
		}
	}
};
