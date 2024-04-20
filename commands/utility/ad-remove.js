const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const AdService = require("../../services/ad");
const { commandsPermission } = require("../../config.json");

const NAME = "ad-remove";

module.exports = {
	name: NAME,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.setDescription("Удаляет роли, выданные через объявления")
		.setDefaultMemberPermissions(PermissionFlagsBits[commandsPermission])
		.setDMPermission(false),

	async execute(interaction, client) {
		const guildId = interaction.member.guild.id;
		const guild = await client.guilds.fetch(guildId);
		await AdService.clearDelayedDeletions();
		AdService.deleteAdRoles(guild);
		await interaction.reply({ content: "Роли будут очищены в течение 10 секунд", ephemeral: true });
	}
};
