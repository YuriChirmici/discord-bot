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

client.commands = new Collection();
commands.forEach((command) => {
    client.commands.set(command.name, command);
});

let clientResolve;
const clientReady = new Promise((resolve) => clientResolve = resolve);
client.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    clientResolve();
});


registerEvents(client);

module.exports = {
	login: async () => {
        client.login(token);
        await clientReady
    },
    client
}
