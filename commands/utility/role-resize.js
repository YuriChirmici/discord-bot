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
			.addNumberOption(option => option.setName("size").setDescription(local.roleResizeParamSize).setRequired(true))
			.setDMPermission(false);
	},

	async execute({ interaction }) {
		const role = interaction.options.getRole("role");
		const size = interaction.options.getNumber("size");

		const oldName = role.name.replaceAll(textResizingService.invisibleLastSymbol, "").trim();
		const newName = textResizingService.resizeText(oldName, size);

		await role.edit({ name: newName });
		await interaction.reply({ content: `Название роли успешно изменено на "${newName}"`, ephemeral: true });
	}
};
