const path = require("path");
const fs = require("fs");
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const configService = require("../../services/config");
const { downloadFile } = require("../../services/helpers");
const adService = require("../../services/ad");

const NAME = getCommandName(__filename);
const srcPath = path.join(__dirname, "../../src");
const nicknamesPath = path.join(srcPath, "nicknames.csv");

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription("Обновляет файл с никами")
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.commandsPermission])
			.setDMPermission(false)
			.addAttachmentOption(option => option.setName("file").setDescription("CSV файл с никами").setRequired(true));
	},

	async execute({ interaction }) {
		await interaction.reply({ content: "Команда будет обработана в ближайшее время.", ephemeral: true });

		const file = interaction.options.getAttachment("file");
		const fileData = await downloadFile(file.url);
		await fs.promises.writeFile(nicknamesPath, fileData);

		await adService.processRatingRolesUpdate(interaction);
	}
};
