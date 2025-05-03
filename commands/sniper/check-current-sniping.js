const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const configService = require("../../services/config");
const gameTrackingService = require("../../services/game-tracking");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription("Получить информацию о текущем отслеживании")
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.config.commandsPermission])
			.setDMPermission(false);
	},

	async execute({ interaction }) {
		const resultText = await gameTrackingService.getCurrentTrackingInfo();
		await interaction.reply(resultText);
	}
};
