const { Events } = require("discord.js");

const findCommand = (interaction) => {
	const command = interaction.client.commands.get(interaction.commandName);
	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
	}

	return command;
}

const registerEvents = (client) => {
	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isChatInputCommand()) return;
		
		const command = findCommand(interaction);
		if (!command) return;

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
		}
	});

	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isButton()) return;

		const customId = interaction.customId;
		interaction.commandName = customId.split("_")[0]
		const command = findCommand(interaction);
		if (!command) return;

		try {
			await command.buttonClick(interaction);
		} catch (error) {
			console.error(error);
		}
	});
}

module.exports = {
	registerEvents
}