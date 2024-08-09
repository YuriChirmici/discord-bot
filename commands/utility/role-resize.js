const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const configService = require("../../services/config");
const localizationService = require("../../services/localization");
const textResizingService = require("../../services/text-resizing");

const local = localizationService.getLocal();
const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription(local.roleResizeCommand)
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.commandsPermission])
			.addRoleOption(option => option.setName("role").setDescription(local.roleResizeParamRole).setRequired(true))
			.addNumberOption(option => option.setName("size").setDescription(local.roleResizeParamSize))
			.setDMPermission(false);
	},

	async execute({ interaction }) {
		const role = interaction.options.getRole("role");
		const size = interaction.options.getNumber("size") || textResizingService.maxSize;

		const oldName = role.name.replaceAll(textResizingService.lastInvisibleSymbol, "").trim();
		const newName = textResizingService.resizeText(oldName, size);
		const newSize =	textResizingService.getTextWidthPretty(newName) - textResizingService.lastSymbolSize +
			textResizingService.lastSymbolActualSize; // extract last symbol difference for font issue

		const oldSize = textResizingService.getTextWidthPretty(oldName);

		await role.edit({ name: newName });
		const resultText = local.roleResizeResult
			.replace("{{newName}}", newName)
			.replace("{{newSize}}", newSize)
			.replace("{{oldName}}", oldName)
			.replace("{{oldSize}}", oldSize);

		await interaction.reply({ content: resultText, ephemeral: true });
	}
};
