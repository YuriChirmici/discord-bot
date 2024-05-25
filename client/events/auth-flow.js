const { Events } = require("discord.js");
const authFlowService = require("../../services/auth-flow");

const registerEvents = (client) => {
	// eslint-disable-next-line no-unused-vars
	client.on(Events.GuildMemberAdd, async (member) => {
		try {
			// await authFlowService.startFlow(member, client);
		} catch (err) {
			logError(err);
		}
	});

	client.on(Events.InteractionCreate, async (interaction) => {
		try {
			const args = { interaction, client };
			const customId = interaction.customId || "";
			interaction.customData = getDataFromCustomId(customId);

			const commandName = customId.split("_")[0];
			if (commandName !== authFlowService.NAME) {
				return;
			}

			if (interaction.isButton()) {
				await authFlowService.buttonClick(args);
			} else if (interaction.isStringSelectMenu()) {
				await authFlowService.stringSelect(args);
			}
		} catch (err) {
			logError(err);
		}
	});

	client.on(Events.MessageCreate, async (message) => {
		try {
			await authFlowService.textInput(message, client);
		} catch (err) {
			logError(err);
		}
	});
};

module.exports = {
	registerEvents
};
