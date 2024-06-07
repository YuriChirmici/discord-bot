const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");
const configService = require("./config");

class CommandService {
	constructor() {
		this.commands = [];
	}

	init() {
		const foldersPath = path.join(__dirname, "../commands");
		const commandFolders = fs.readdirSync(foldersPath);

		for (const folder of commandFolders) {
			const commandsPath = path.join(foldersPath, folder);
			const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
			for (const file of commandFiles) {
				const filePath = path.join(commandsPath, file);
				const command = require(filePath);
				if (command.get && command.execute) {
					this.commands.push({
						...command,
						data: command.get()
					});
				} else {
					console.log(`[WARNING] The command at ${filePath} is missing a required "get" or "execute" property.`);
				}
			}
		}
	}

	getCommandByName(name) {
		return this.commands.find((command) => command.name === name);
	}

	async deployCommands() {
		try {
			const body = this.commands.map((command) => command.data.toJSON());
			console.log(`Started refreshing ${body.length} application (/) commands.`);

			const { clientId, guildId, token } = configService;
			const rest = new REST().setToken(token);
			const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId),	{ body });

			console.log(`Successfully reloaded ${data.length} application (/) commands.`);
		} catch (err) {
			logError(err);
		}
	}
}

module.exports = new CommandService();

