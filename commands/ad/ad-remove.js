const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const adService = require("../../services/ad");
const configService = require("../../services/config");
const localizationService = require("../../services/localization");

const local = localizationService.getLocal();
const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription(local.adRemoveCommandDesc)
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.commandsPermission])
			.setDMPermission(false);
	},

	async execute({ interaction, client }) {
		await interaction.reply({ content: local.adRemoveReply, ephemeral: true });
		await adService.runAdDeletionTasks(client);
	}
};
