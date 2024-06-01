const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const adService = require("../../services/ad");
const { commandsPermission } = require("../../config.json");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.setDescription("Удаляет роли, выданные через объявления")
		.setDefaultMemberPermissions(PermissionFlagsBits[commandsPermission])
		.setDMPermission(false),

	async execute(interaction, client) {
		await interaction.reply({ content: "Роли будут очищены в течение 10 секунд", ephemeral: true });
		await adService.runAdDeletionTasks(client);
	}
};
