const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const configService = require("../../services/config");
const roleDividerService = require("../../services/roles/role-dividers");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription("Исправить разделители ролей для указанных пользователей или всех участников сервера")
			.addSubcommand(subcommand =>
				subcommand
					.setName("user")
					.setDescription("Исправить разделители ролей для конкретного пользователя")
					.addUserOption(option =>
						option
							.setName("target")
							.setDescription("Пользователь, для которого нужно исправить разделители")
							.setRequired(true)
					)
			)
			.addSubcommand(subcommand =>
				subcommand
					.setName("all")
					.setDescription("Исправить разделители ролей для всех участников сервера")
			)
			.setDefaultMemberPermissions(PermissionFlagsBits[configService.config.commandsPermission])
			.setDMPermission(false);
	},

	async execute({ interaction }) {
		await interaction.deferReply({ ephemeral: true });

		try {
			const subcommand = interaction.options.getSubcommand();

			// Refresh role groups first
			await roleDividerService.refreshRolesGroups(interaction.client);

			if (subcommand === "user") {
				const targetUser = interaction.options.getUser("target");
				const member = await interaction.guild.members.fetch(targetUser.id);

				await roleDividerService.fixMemberRolesDividers(interaction.client, member);

				await interaction.editReply({
					content: `Разделители ролей исправлены для <@${targetUser.id}>`
				});

			} else if (subcommand === "all") {
				await interaction.editReply({
					content: "Начинаю исправление разделителей для всех участников... Это может занять некоторое время."
				});

				const { processed, modified } = await roleDividerService.fixMemberRolesDividersAll(interaction.client, interaction.guild);

				await interaction.editReply({
					content: `Готово! Обработано ${processed} участников, изменено ${modified} участников.`
				});
			}
		} catch (err) {
			logError(err);
			await interaction.editReply({
				content: "Произошла ошибка при исправлении разделителей ролей."
			});
		}
	}
};
