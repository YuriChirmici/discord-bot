const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const configService = require("../../services/config");
const fs = require("fs");
const path = require("path");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription("Установить в конфиг cookie для заявок")
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.commandsPermission])
			.addStringOption(option => option.setName("cookie").setDescription("Строка с cookie для заявок").setRequired(true))
			.setDMPermission(false);
	},

	async execute({ interaction }) {
		const filePath = path.join(__dirname + "../../../config/main.json");
		const cookie = interaction.options.getString("cookie").trim();
		const currentConfigFile = require(filePath);

		configService.gameTracking.replayFetchCookie = currentConfigFile.gameTracking.replayFetchCookie = cookie;
		fs.writeFileSync(filePath, JSON.stringify(currentConfigFile, null, 2));

		await interaction.reply("Новые куки успешно установлены");
	}
};
