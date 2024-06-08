const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const configService = require("../../services/config");
const adService = require("../../services/ad");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription("Обновлять рейтинговые роли")
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.commandsPermission])
			.setDMPermission(false);
	},

	async execute({ interaction }) {
		await interaction.reply({ content: "Команда будет обработана в ближайшее время.", ephemeral: true });
		await adService.processRatingRolesUpdate(interaction);
	}
};
