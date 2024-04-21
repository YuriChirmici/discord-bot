const { Events, PermissionFlagsBits } = require("discord.js");
const { commandsPermission } = require("../../config.json");
const { registerEvents: registerVoiceEvents } = require("./voice");
const { registerEvents: registerAuthFlowEvents } = require("./auth-flow");

const findCommand = (commands, commandName) => {
	const command = commands.get(commandName);
	return command;
};

const parseCustomArgs = (message, commandArgs) => {
	const argsArr = [];
	let arg = "";
	for (let c of message) {
		if (c === "}") {
			argsArr.push(arg.trim());
		} else if (c === "{") {
			arg = "";
		} else {
			arg += c;
		}
	}

	const result = {};
	for (let argStr of argsArr) {
		const parts = argStr.split("=");
		const key = parts.shift().trim();
		let value = parts.join("=").trim();
		if (commandArgs[key].type === "number") {
			value = Number.parseFloat(value);
		}
		result[key] = value;
	}

	return result;
};

// for custom commands
const getMissingArgs = (commandArgs = {}, messageArgs = {}) => {
	const missingArgs = [];
	for (let key in commandArgs) {
		if (commandArgs[key].required && !messageArgs[key]) {
			missingArgs.push(key);
		}
	}

	return missingArgs;
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

			const messageArgs = parseCustomArgs(argsArr.join(" "), command.customArgs);
			const missingArgs = getMissingArgs(command.customArgs, messageArgs);
			if (missingArgs.length) {
				await message.reply("Отсутвтуют обязательные параметры: " + missingArgs.join(", "));
				return;
			}

			message.customArgs = messageArgs;
			await command.execute(message, client);
			await message.delete();
		} catch (err) {
			logError(err);
		}
	});
};

module.exports = {
	registerEvents
};
