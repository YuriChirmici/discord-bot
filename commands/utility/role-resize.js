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
			.addStringOption(option => option.setName("text-align").setDescription(local.roleResizeParamAlignDesc).setRequired(true).addChoices(
				{ name: local.roleResizeParamAlignLeft, value: textResizingService.textAlign.left },
				{ name: local.roleResizeParamAlignCenter, value: textResizingService.textAlign.center },
				{ name: local.roleResizeParamAlignRight, value: textResizingService.textAlign.right },
			))
			.addNumberOption(option => option.setName("size").setDescription(local.roleResizeParamSize))
			.setDMPermission(false);
	},

	async execute({ interaction }) {
		const role = interaction.options.getRole("role");
		const size = interaction.options.getNumber("size") || textResizingService.maxSize;
		const textAlign = interaction.options.getString("text-align");

		const oldName = role.name.replaceAll(textResizingService.lastInvisibleSymbol, "").trim();
		const newName = textResizingService.resizeText(oldName, size, textAlign);

		await role.edit({ name: newName });
		const resultText = local.roleResizeResult
			.replace("{{newName}}", newName)
			.replace("{{oldName}}", oldName);

		await interaction.reply({ content: resultText, ephemeral: true });
	}
};
