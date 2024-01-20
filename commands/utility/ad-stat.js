const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const AdService = require("../../services/ad");

const NAME = "ad-stat";

module.exports = {
	name: NAME,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.setDescription("Показывает статистику ролей, выданных через объявление")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
		.setDMPermission(false),

	async execute(interaction, client) {
		const guildId = interaction.member.guild.id;
		const guild = await client.guilds.fetch(guildId);
		const members = await AdService.getGuildMembers(guild);
		const stat = await AdService.getStatistics(members);

		await interaction.reply({ content: stat || "Пусто", ephemeral: true });
	}
};