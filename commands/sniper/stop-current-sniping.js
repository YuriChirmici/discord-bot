const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const configService = require("../../services/config");
const gameTrackingService = require("../../services/game-tracking");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription("Остановить текущее отслеживание игрока")
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.commandsPermission])
			.addUserOption(option => option.setName("member").setDescription("Пользователь, которому нужно остановить отслеживание").setRequired(true))
			.setDMPermission(false);
	},

	async execute({ interaction }) {
		const member = interaction.options.getUser("member");
		const { profile } = await gameTrackingService.stopTrackingMember(member.id);
		if (!profile) {
			await interaction.reply(`Игрок ${member} не отслеживается`);
			return;
		}

		await interaction.reply(`Отслеживание игрока ${member} остановлено`);
	}
};
