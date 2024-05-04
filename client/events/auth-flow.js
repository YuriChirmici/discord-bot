const { Events } = require("discord.js");
const authFlowService = require("../../services/auth-flow");

const registerEvents = (client) => {
	client.on(Events.GuildMemberAdd, async (member) => {
		try {
			await authFlowService.startFlow(member, client);
		} catch (err) {
			logError(err);
		}
	});

	client.on(Events.InteractionCreate, async (interaction) => {
		try {
			const args = { interaction, client };
			if (interaction.isButton()) {
				const commandName = (interaction.customId || "").split("_")[0];
				if (commandName === authFlowService.NAME) {
					await authFlowService.buttonClick(args);
				}
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
