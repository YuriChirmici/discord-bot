const { Events, PermissionFlagsBits } = require("discord.js");
const { commandsPermission } = require("../../config.json");
const { registerEvents: registerVoiceEvents } = require("./voice");
const { registerEvents: registerAuthFlowEvents } = require("./auth-flow");

const findCommand = (commands, commandName) => {
	const command = commands.get(commandName);
	return command;
};

const parseCustomArgs = (message) => {
	const args = [];

	let arg = "";
	for (let c of message) {
		if (c === "}") {
			args.push(arg.trim());
		} else if (c === "{") {
			arg = "";
		} else {
			arg += c;
		}
	}

	return args;
};

const chatInputCommand = async ({ interaction, client }) => {
	const command = findCommand(interaction.client.commands, interaction.commandName);
	if (!command) {
		return;
	}

	await command.execute(interaction, client);
};

const buttonInteraction = async ({ interaction }) => {
	const customId = interaction.customId;
	interaction.commandName = customId.split("_")[0];
	const command = findCommand(interaction.client.commands, interaction.commandName);
	if (!command) {
		return;
	}

	await command.buttonClick(interaction);
};

const registerEvents = (client) => {
	registerVoiceEvents(client);
	registerAuthFlowEvents(client);

	client.on(Events.InteractionCreate, async (interaction) => {
		try {
			const args = { interaction, client };

			if (interaction.isChatInputCommand()) {
				return await chatInputCommand(args);
			} else if (interaction.isButton()) {
				return await buttonInteraction(args);
			}
		} catch (err) {
			logError(err);
		}
	});

	client.on(Events.MessageCreate, async (message) => {
		try {
			const msg = message.content.trim();
			// check if is custom command with "!"
			if (!message.member.permissions.has(PermissionFlagsBits[commandsPermission]) || msg[0] !== "!") {
				return;
			}

			const argsArr = msg.split(" ");
			const commandName = argsArr.shift().substring(1);
			const command = findCommand(client.commands, commandName);
			if (!command) {
				return;
			}

			message.customArgs = parseCustomArgs(argsArr.join(" "));

			await message.delete();
			await command.execute(message, client);
		} catch (err) {
			logError(err);
		}
	});
};

module.exports = {
	registerEvents
};
