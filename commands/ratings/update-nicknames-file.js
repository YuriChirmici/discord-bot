const path = require("path");
const fs = require("fs");
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const configService = require("../../services/config");
const { downloadFile } = require("../../services/helpers");
const adService = require("../../services/ad");
const localizationService = require("../../services/localization");

const local = localizationService.getLocal();
const NAME = getCommandName(__filename);
const srcPath = path.join(__dirname, "../../src");
const nicknamesPath = path.join(srcPath, "nicknames.csv");

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription(local.updateNicknamesCommandDesc)
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.commandsPermission])
			.setDMPermission(false)
			.addAttachmentOption(option => option.setName("file").setDescription(local.updateNicknamesFileParamDesc).setRequired(true));
	},

	async execute({ interaction }) {
		await interaction.reply({ content: local.updateNicknamesReply, ephemeral: true });

		const file = interaction.options.getAttachment("file");
		const fileData = await downloadFile(file.url);
		await fs.promises.writeFile(nicknamesPath, fileData);

		await adService.processRatingRolesUpdate(interaction);
	}
};
