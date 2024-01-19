const { Events } = require("discord.js");

const registerEvents = (client) => {
	client.once(Events.ClientReady, readyClient => {
		console.log(`Ready! Logged in as ${readyClient.user.tag}`);
	});
	
	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isChatInputCommand()) return;
		
		const command = interaction.client.commands.get(interaction.commandName);
	
		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}
	
		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
		}
	});
}

module.exports = {
	registerEvents
}