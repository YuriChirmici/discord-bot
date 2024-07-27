const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const formsService = require("../../services/forms");
const localizationService = require("../../services/localization");

const local = localizationService.getLocal();
const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription(local.authTestCommandDesc)
			.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
			.setDMPermission(false);
	},

	async execute({ interaction, client }) {
		const { channel } = await formsService.startForm({
			interaction,
			member: interaction.member,
			client,
			formName: formsService.formsNames.auth
		});

		await interaction.reply({ content: local.authTestReply.replace("{{channelId}}", channel.id), ephemeral: true });
	},
};
