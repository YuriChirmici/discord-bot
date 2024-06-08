const https = require("https");
const { Events, PermissionFlagsBits } = require("discord.js");
const configService = require("../../config");
const { registerEvents: registerVoiceEvents } = require("./voice");
const { registerEvents: registerAuthFlowEvents } = require("./auth-flow");
const customIdService = require("../../custom-id-service");

const findCommand = (commands, commandName) => {
	if (commandName) {
		return commands.get(commandName);
	}
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
		if (commandArgs[key] && commandArgs[key].type === "number") {
			value = Number.parseFloat(value);
		}
		result[key] = value;
	}

	return result;
};

const getFileConfigArgs = (attachments) => new Promise((resolve, reject) => {
	const attachment = attachments[0];
	if (!attachment) {
		return;
	}
	const nameParts = attachment.name.split(".");
	if (nameParts[nameParts.length - 1] !== "json") {
		// support only json config
		return;
	}

	https.get(attachment.url, (res) => {
		let result = "";
		res.on("data", chunk => result += chunk);
		res.on("end", () => {
			const config = JSON.parse(result);
			resolve(config);
		});
	}).on("error", (err) => reject(err));
});

const registerEvents = (client) => {
	registerVoiceEvents(client);
	registerAuthFlowEvents(client);

	client.on(Events.InteractionCreate, async (interaction) => {
		try {
			const args = { interaction, client };
			interaction.customData = await customIdService.getDataFromCustomId(interaction.customId);
			const command = findCommand(interaction.client.commands, interaction.customData?.commandName);
			if (!command) {
				return;
			}

			if (interaction.isChatInputCommand()) {
				return await command.execute(args);
			} else if (interaction.isButton()) {
				return await command.buttonClick(args);
			} else if (interaction.isStringSelectMenu()) {
				return await command.stringSelect(args);
			}
		} catch (err) {
			logError(err);
		}
	});

	client.on(Events.MessageCreate, async (message) => {
		try {
			const msg = message.content.trim();
			// check if is custom command with "!"
			if (!message.member.permissions.has(PermissionFlagsBits[configService.commandsPermission]) || msg[0] !== "!") {
				return;
			}

			const argsArr = msg.split(" ");
			const commandName = argsArr.shift().substring(1);
			const command = findCommand(client.commands, commandName);
			if (!command) {
				return;
			}

			let messageArgs;
			if (message.attachments.size) {
				messageArgs = await getFileConfigArgs(Array.from(message.attachments.values()));
			} else {
				messageArgs = parseCustomArgs(argsArr.join(" "), command.customArgs);
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
