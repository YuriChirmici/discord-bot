const { Client, Collection, GatewayIntentBits } = require("discord.js");
const { commands } = require("../services/commands");
const { registerEvents } = require("./events");
const { token } = require("../config.json");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
commands.forEach((command) => {
    client.commands.set(command.data.name, command);
});

registerEvents(client);

module.exports = {
	login: () => client.login(token)
}
