const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const AdService = require("../../services/ad");

const NAME = "ad-remove";

module.exports = {
	name: NAME,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.setDescription("Удаляет роли, выданные через объявления")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDMPermission(false),

	async execute(interaction, client) {
		const guildId = interaction.member.guild.id;
		const guild = await client.guilds.fetch(guildId);
		await AdService.clearDelayedDeletions();
		await AdService.deleteAdRoles(guild);
		await interaction.reply({ content: "Роли очищены!", ephemeral: true });
	}
};