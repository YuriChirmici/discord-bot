const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { commandsPermission } = require("../../config.json");
const adService = require("../../services/ad");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.setDescription("Обновлять рейтинговые роли")
		.setDefaultMemberPermissions(PermissionFlagsBits[commandsPermission])
		.setDMPermission(false),

	async execute(interaction) {
		await interaction.reply({ content: "Команда будет обработана в ближайшее время.", ephemeral: true });
		await adService.processRatingRolesUpdate(interaction);
	}
};
