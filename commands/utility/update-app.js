const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const { commandsPermission } = require("../../config.json");
const { updateApp, deployCommands } = require("../../shell-commands");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.setDescription("Обновляет бота до последней версии.")
		.setDefaultMemberPermissions(PermissionFlagsBits[commandsPermission])
		.setDMPermission(false),

	async execute(interaction) {
		let message;
		let hasChanges = false;
		try {
			hasChanges = await updateApp();
			if (hasChanges) {
				message = "Успешно обновлено. Рестарт через 10 секунд.";
			} else {
				message = "Обновлений не найдено!";
			}
		} catch (err) {
			message = `Error ${err}`;
		}

		await interaction.reply({ content: message, ephemeral: true });
		if (hasChanges) {
			deployCommands();
		}
	}
};
