const { Events } = require("discord.js");
const formsService = require("../../formsService");
const customIdService = require("../../custom-id-service");

const registerEvents = (client) => {
	client.on(Events.GuildMemberAdd, async (member) => {
		try {
			await formsService.startForm(member, client, "auth");
		} catch (err) {
			logError(err);
		}
	});

	client.on(Events.GuildMemberRemove, async (member) => {
		try {
			await formsService.clearOldMemberData(client, member.id);
		} catch (err) {
			logError(err);
		}
	});

	client.on(Events.InteractionCreate, async (interaction) => {
		try {
			const args = { interaction, client };
			let commandName = interaction.commandName;
			if (!commandName) {
				interaction.customData = await customIdService.getDataFromCustomId(interaction.customId);
				commandName = interaction.customData?.commandName;
			}

			if (commandName !== formsService.NAME) {
				return;
			}

			if (interaction.isButton()) {
				await formsService.buttonClick(args);
			} else if (interaction.isStringSelectMenu()) {
				await formsService.stringSelect(args);
			}
		} catch (err) {
			logError(err);
		}
	});

	client.on(Events.MessageCreate, async (message) => {
		try {
			await formsService.textInput(message, client);
		} catch (err) {
			logError(err);
		}
	});
};

module.exports = {
	registerEvents
};