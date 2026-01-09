const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const lodash = require("lodash");
const configService = require("../../services/config");
const localizationService = require("../../services/localization");

const local = localizationService.getLocal();
const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription(local.pingCommandDesc)
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.config.commandsPermission])
			.setDMPermission(false);
	},

	async execute({ interaction }) {
		const content = local.pingReply + " " + lodash.random(1000, 9999); // Added
		await interaction.reply({ content, ephemeral: true });
	}
};
