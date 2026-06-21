const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const { exec } = require("child_process");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription("Взять последнюю версию бота и перезапустить его")
			.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
			.setDMPermission(false);
	},

	async execute({ interaction }) {
		await interaction.deferReply({ ephemeral: true });

		exec("git pull && npm install --omit=dev", async (err, stdout, stderr) => {
			if (err) {
				logError(err, "Update command failed");
				await interaction.editReply({ content: `Ошибка при обновлении:\n\`\`\`${stderr || err.message}\`\`\`` });
				return;
			}

			await interaction.editReply({ content: `Обновление успешно:\n\`\`\`${stdout}\`\`\`\nПерезапускаю...` });

			// Restart after reply is sent
			setTimeout(() => {
				process.exit(0);
			}, 1000);
		});
	}
};
