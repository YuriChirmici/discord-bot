const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const configService = require("../../services/config");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription("Установить в конфиг cookie для заявок")
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.config.commandsPermission])
			.addStringOption(option => option.setName("cookie").setDescription("Строка с cookie для заявок").setRequired(true))
			.setDMPermission(false);
	},

	async execute({ interaction }) {
		const cookie = interaction.options.getString("cookie").trim();
		configService.setCookie(cookie);

		await interaction.reply("Новые куки успешно установлены");
	}
};
