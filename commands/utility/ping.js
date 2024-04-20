const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const { commandsPermission } = require("../../config.json");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.setDescription("Проверка")
		.setDefaultMemberPermissions(PermissionFlagsBits[commandsPermission])
		.setDMPermission(false),

	async execute(interaction) {
		await interaction.reply({ content: "Pong", ephemeral: true });
	}
};
