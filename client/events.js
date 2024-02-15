const { Events, PermissionFlagsBits } = require("discord.js");
const { commandsPermission } = require("../config.json");

const findCommand = (commands, commandName) => {
	const command = commands.get(commandName);
	if (!command) {
		logError(`No command matching ${commandName} was found.`);
	}

	return command;
}

const parseCustomArgs = (message) => {
	const args = [];

	let arg = "";
	for (let c of message) {
		if (c === "}") {
			args.push(arg.trim());
		} else if (c === "{") {
			arg = "";
		} else {
			arg += c
		}
	}

	return args;
}

const registerEvents = (client) => {
	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isChatInputCommand()) return;

		const command = findCommand(interaction.client.commands, interaction.commandName);
		if (!command) return;

		try {
			await command.execute(interaction, client);
		} catch (error) {
			logError(error);
		}
	});

	client.on(Events.MessageCreate, async (message) => {
		const msg = message.content.trim();
		if (!message.member.permissions.has(PermissionFlagsBits[commandsPermission]) || msg[0] !== "!") return;

		const argsArr = msg.split(" ");
		const commandName = argsArr.shift().substring(1);
		const command = findCommand(client.commands, commandName);
		if (!command) return;

		message.customArgs = parseCustomArgs(argsArr.join(" "));
		try {
			await message.delete();
			await command.execute(message, client);
		} catch (error) {
			logError(error);
		}
	});

	client.on(Events.InteractionCreate, async (interaction) => {
		if (!interaction.isButton()) return;

		const customId = interaction.customId;
		interaction.commandName = customId.split("_")[0]
		const command = findCommand(interaction.client.commands, interaction.commandName);
		if (!command) return;

		try {
			await command.buttonClick(interaction);
		} catch (error) {
			logError(error);
		}
	});
}

module.exports = {
	registerEvents
}