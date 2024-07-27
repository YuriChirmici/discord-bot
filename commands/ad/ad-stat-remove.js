const {	SlashCommandBuilder, PermissionFlagsBits, ButtonStyle } = require("discord.js");
const adService = require("../../services/ad");
const configService = require("../../services/config");
const { createButtons } = require("../../services/helpers");
const localizationService = require("../../services/localization");

const local = localizationService.getLocal();
const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription(local.adStatRemoveCommandDesc)
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.commandsPermission])
			.setDMPermission(false);
	},

	async execute({ interaction }) {
		const buttonsConfig = [ [ {
			style: ButtonStyle.Danger,
			text: local.adStatRemoveConfirm
		} ] ];
		const components = await createButtons(buttonsConfig, { commandName: NAME, data: { action: "confirm" } });

		await interaction.reply({
			components,
			ephemeral: true
		});
	},

	async buttonClick({ interaction }) {
		const { action } = interaction.customData;
		if (action === "confirm") {
			await adService.clearStats();
			await interaction.reply({
				content: local.adStatRemoveSuccess,
				ephemeral: true
			});
		}
	}
};
