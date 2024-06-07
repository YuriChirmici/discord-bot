const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder
} = require("discord.js");
const adService = require("../../services/ad");
const configService = require("../../services/config");

const NAME = "ad-stat";

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription("Показывает статистику ролей, выданных через объявление")
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.commandsPermission])
			.addUserOption(option => option.setName("user").setDescription("Пользователь"))
			.setDMPermission(false);
	},

	async execute(interaction, client) {
		const targetMember = interaction.options.getUser("user");

		if (targetMember) {
			const stat = await adService.getMemberStatistic(targetMember);
			await interaction.reply(stat);
			return;
		}

		const guildId = interaction.member.guild.id;
		const guild = await client.guilds.fetch(guildId);
		const members = await adService.getGuildMembers(guild);
		const stat = await adService.getStatistics(members);

		const embeds = this.divideTextToEmbeds(stat);

		await interaction.reply({
			content: "Статистика:",
			embeds,
			ephemeral: true
		});
	},

	divideTextToEmbeds(text) {
		const embeds = [];
		const rows = text.split("\n");
		let content = "";
		let part = 1;
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			content += row + "\n";
			if (content.length > 1750 || i === rows.length - 1) {
				const embed = new EmbedBuilder()
					.setColor(configService.adsConfig.borderColor)
					.setTitle("Часть " + part)
					.setDescription(content);

				embeds.push(embed);
				content = "";
				part++;
			}
		}

		return embeds;
	}
};