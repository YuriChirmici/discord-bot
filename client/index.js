const { Client, Events, Collection, GatewayIntentBits } = require("discord.js");
const { commands } = require("../services/commands");
const { registerEvents } = require("./events");
const { token } = require("../config.json");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildVoiceStates,
	]
});

const startClient = async () => new Promise((resolve) => {
	client.commands = new Collection();
	commands.forEach((command) => {
		client.commands.set(command.name, command);
	});

	client.once(Events.ClientReady, readyClient => {
		console.log(`Ready! Logged in as ${readyClient.user.tag}`);
		resolve();
	});

	registerEvents(client);
});

module.exports = {
	login: async () => {
		client.login(token);
		await startClient();
	},
	client
};
