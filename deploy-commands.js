const { REST, Routes } = require("discord.js");
const { clientId, guildId, token } = require("./config.json");
const { commands } = require("./services/commands");

const deployCommands = [];

commands.forEach((command) => {
	deployCommands.push(command.data.toJSON());
});

const rest = new REST().setToken(token);

(async () => {
	try {
		console.log(`Started refreshing ${deployCommands.length} application (/) commands.`);

		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: deployCommands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (err) {
		console.error(err);
	}
})();
