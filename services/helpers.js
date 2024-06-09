const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder
} = require("discord.js");
const https = require("https");
const jsdom = require("jsdom");
const customIdService = require("./custom-id-service");

const { JSDOM } = jsdom;

module.exports.createButtons = async (buttonsConfig = [], customIdData = {}) => {
	customIdData.data ||= {};

	let index = 0;
	let components = [];
	for (let row of buttonsConfig) {
		const buttons = [];
		for (let btn of row) {
			const customId = await customIdService.createCustomId({ ...customIdData, data: { ...customIdData.data, index } });
			buttons.push(createButton({ ...btn, customId }));
			index++;
		}

		components.push(new ActionRowBuilder().addComponents(...buttons));
	}

	return components;
};

const createButton = ({ customId, emoji, url, disabled, text, style }) => {
	let button = new ButtonBuilder().setStyle(style || ButtonStyle.Secondary);

	if (emoji) {
		button = button.setEmoji(emoji);
	}

	if (text) {
		button = button.setLabel(text);
	}

	if (url) {
		button = button.setURL(url);
	} else {
		button = button.setCustomId(customId);
	}

	if (disabled) {
		button = button.setDisabled(true);
	}

	return button;
};

module.exports.createSelect = (customId, { placeholder, min, max, options }) => {
	let select = new StringSelectMenuBuilder()
		.setCustomId(customId);

	if (placeholder) {
		select = select.setPlaceholder(placeholder);
	}

	if (min) {
		select = select.setMinValues(+min);
	}

	if (max) {
		select = select.setMaxValues(Math.min(max, options.length));
	}

	const optionsComponents = [];
	options.forEach(({ value, text, description, emoji, isDefault }) => {
		let option = new StringSelectMenuOptionBuilder()
			.setLabel(text)
			.setValue(value || text);

		if (description) {
			option = option.setDescription(description);
		}

		if (emoji) {
			option = option.setEmoji(emoji);
		}

		if (isDefault) {
			option = option.setDefault(isDefault);
		}

		optionsComponents.push(option);
	});

	if (optionsComponents.length) {
		select = select.addOptions(optionsComponents);
	}

	return new ActionRowBuilder().addComponents([ select ]);
};

module.exports.getButtonsFlat = (buttonsRows) => buttonsRows.flat();

const downloadFile = module.exports.downloadFile = (url) => new Promise((resolve, reject) => {
	https.get(url, (res) => {
		let result = "";
		res.on("data", (data) => {
			result += data;
		});

		res.on("end", () => {
			resolve(result);
		});

	}).on("error", (err) => {
		reject(err);
	});
});

module.exports.getDomByUrl = async (url) => {
	const fileData = await downloadFile(url);
	return new JSDOM(fileData);
};

// workaround, discord has bug when we add and remove roles at the same time
module.exports.setRoles = (member, rolesAdd = [], rolesRemove = []) => {
	let promises = [];

	if (rolesRemove.length) {
		if (rolesAdd.length) {
			promises.push(Promise.resolve());
		}

		promises.push(member.roles.remove(rolesRemove)
			.then(() => {
				if (rolesAdd.length) {
					return member.roles.add(rolesAdd);
				}
			})
		);
	} else {
		promises.push(member.roles.add(rolesAdd));
	}

	return promises;
};

module.exports.ensureDiscordRequests = async (requests, limit = 40) => {
	const promisesParts = _splitArray(requests, limit);
	const results = [];
	for (let i = 0; i < promisesParts.length; i++) {
		const result = await Promise.all(promisesParts[i]);
		results.push(...result);

		// skip sleep after last part
		if (i !== promisesParts.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}

	return results;
};

const _splitArray = (arr = [], limit) => {
	const result = [];
	let currentPart = [];

	for (let i = 0; i < arr.length; i++) {
		const item = arr[i];
		currentPart.push(item);
		if ((i + 1) % limit === 0) {
			result.push(currentPart);
			currentPart = [];
		}
	}

	if (currentPart.length) {
		result.push(currentPart);
	}

	return result;
};

module.exports.removeMessagesAfterDate = async (channel, date) => {
	let messages = await channel.messages.fetch({ limit: 100 });
	messages = messages.filter((msg) => msg.createdTimestamp > date);

	await channel.bulkDelete(messages);
};
