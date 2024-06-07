const { Client, Events, Collection, GatewayIntentBits } = require("discord.js");
const commandsService = require("../commands");
const { registerEvents } = require("./events");
const configService = require("../config");

class ClientService {
	async login() {
		await this._createClient();
	}

	getClient() {
		return this.client;
	}

	_createClient() {
		return new Promise((resolve) => {
			const client = new Client({
				intents: [
					GatewayIntentBits.Guilds,
					GatewayIntentBits.GuildMembers,
					GatewayIntentBits.GuildMessages,
					GatewayIntentBits.MessageContent,
					GatewayIntentBits.GuildVoiceStates,
				]
			});

			client.commands = new Collection();
			commandsService.commands.forEach((command) => {
				client.commands.set(command.name, command);
			});

			registerEvents(client);

			client.once(Events.ClientReady, readyClient => {
				console.log(`Ready! Logged in as ${readyClient.user.tag}`);
				resolve();
			});

			client.login(configService.token);
			this.client = client;
		});
	}
}

module.exports = new ClientService();
