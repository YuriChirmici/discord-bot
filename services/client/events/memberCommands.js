const { Events } = require("discord.js");
const memberCommandsService = require("../../member-commands");
const customIdService = require("../../custom-id");

const registerEvents = (client) => {
	client.on(Events.InteractionCreate, async (interaction) => {
		try {
			const args = { interaction, client };
			let commandName = interaction.commandName;
			if (!commandName) {
				interaction.customData = await customIdService.getDataFromCustomId(interaction.customId);
				commandName = interaction.customData?.commandName;
			}

			if (commandName !== memberCommandsService.NAME) {
				return;
			}

			if (interaction.isModalSubmit()) {
				return await memberCommandsService.submitModal(args);
			}
		} catch (err) {
			logError(err);
		}
	});
};

module.exports = {
	registerEvents
};
