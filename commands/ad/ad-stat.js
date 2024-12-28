const {	SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const adService = require("../../services/ad");
const configService = require("../../services/config");
const { createEmbed, getGuildMembers } = require("../../services/helpers");
const localizationService = require("../../services/localization");

const local = localizationService.getLocal();
const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription(local.adStatCommandDesc)
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.commandsPermission])
			.addUserOption(option => option.setName("user").setDescription(local.adStatUserParamDesc))
			.setDMPermission(false);
	},

	async execute({ interaction, client }) {
		const targetMember = interaction.options.getUser("user");

		if (targetMember) {
			const stat = await adService.getMemberStatistic(targetMember);
			await interaction.reply(stat);
			return;
		}

		const guildId = interaction.member.guild.id;
		const guild = await client.guilds.fetch(guildId);
		const members = await getGuildMembers(guild);
		const stat = await adService.getStatistics(members);

		const embeds = this.divideTextToEmbeds(stat);

		await interaction.reply({
			content: local.adStatReplyContent,
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
				const embed = createEmbed({ description: content, title: `${local.part} ${part}` });
				embeds.push(embed);
				content = "";
				part++;
			}
		}

		return embeds;
	}
};
