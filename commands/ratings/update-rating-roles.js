const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const configService = require("../../services/config");
const adService = require("../../services/ad");
const localizationService = require("../../services/localization");

const local = localizationService.getLocal();
const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription(local.updateRatingCommandDesc)
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.commandsPermission])
			.setDMPermission(false);
	},

	async execute({ interaction }) {
		await interaction.reply({ content: local.updateRatingReply, ephemeral: true });
		await adService.processRatingRolesUpdate(interaction);
	}
};
