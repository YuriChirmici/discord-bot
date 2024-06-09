const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const formsService = require("../../services/forms");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription("Тест авторизации")
			.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
			.setDMPermission(false);
	},

	async execute({ interaction, client }) {
		const { channel } = await formsService.startForm({
			interaction,
			member: interaction.member,
			client,
			formName: "auth"
		});

		await interaction.reply({ content: `Заявка создана, перейдите в ветку <#${channel.id}>`, ephemeral: true });
	},
};
