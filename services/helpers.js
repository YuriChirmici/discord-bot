const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	EmbedBuilder
} = require("discord.js");
const https = require("https");
const jsdom = require("jsdom");
const customIdService = require("./custom-id");
const configService = require("./config");

const { JSDOM } = jsdom;

module.exports.createButtons = async (buttonsConfig = [], customIdData = {}) => {
	customIdData.data ||= {};

	let index = 0;
	let components = [];
	for (let row of buttonsConfig) {
		const buttons = [];
		for (let btn of row) {
			const customId = await customIdService.createCustomId({ ...customIdData, data: { ...customIdData.data, index } });
			buttons.push(createButton(customId, btn));
			index++;
		}

		components.push(new ActionRowBuilder().addComponents(...buttons));
	}

	return components;
};

const createButton = (customId, { emoji, url, disabled, text, style }) => {
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
			.setValue(value || text)
			.setDefault(!!isDefault);

		if (description) {
			option = option.setDescription(description);
		}

		if (emoji) {
			option = option.setEmoji(emoji);
		}

		optionsComponents.push(option);
	});

	if (optionsComponents.length) {
		select = select.addOptions(optionsComponents);
	}

	return new ActionRowBuilder().addComponents([ select ]);
};

module.exports.createModal = (customId, { title, items }) => {
	const modal = new ModalBuilder()
		.setCustomId(customId)
		.setTitle(title);

	const components = [];
	for (let item of items) {
		const component = createTextInput(item.key || item.label, item);
		components.push(new ActionRowBuilder().addComponents(component));
	}

	modal.addComponents(...components);

	return modal;
};

const createTextInput = (customId, { label, style, min, max, placeholder, value, required }) => {
	let component = new TextInputBuilder()
		.setCustomId(customId)
		.setLabel(label)
		.setStyle(style || TextInputStyle.Short)
		.setRequired(!!required);

	if (min) {
		component = component.setMinLength(min);
	}

	if (max) {
		component = component.setMaxLength(max);
	}

	if (placeholder) {
		component = component.setPlaceholder(placeholder);
	}

	if (value) {
		component = component.setValue(value);
	}

	return component;
};

module.exports.getButtonsFlat = (buttonsRows) => buttonsRows.flat();

const downloadFile = module.exports.downloadFile = (url) => new Promise((resolve, reject) => {
	https.get(url, (res) => {
		res.setEncoding("utf8");
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

module.exports.setRoles = async (member, rolesAdd = [], rolesRemove = [], removeFirst = true) => {
	const { preparedAdd, preparedRemove } = prepareMemberRoles(member, rolesAdd, rolesRemove, removeFirst);

	if (preparedRemove.length) {
		await member.roles.remove(preparedRemove);
	}

	if (preparedAdd.length) {
		await member.roles.add(preparedAdd);
	}
};

const prepareMemberRoles = module.exports.prepareMemberRoles = (member, rolesForAdd = [], rolesForRemove = [], removeFirst = true) => {
	let preparedAdd, preparedRemove;

	const hasMemberRole = (role) => member.roles.cache.find(({ id }) => id === role);

	if (removeFirst) {
		preparedRemove = rolesForRemove.filter((role) => !rolesForAdd.includes(role) && hasMemberRole(role));
		preparedAdd = rolesForAdd.filter((role) => !hasMemberRole(role));
	} else {
		preparedAdd = rolesForAdd.filter((role) => !rolesForRemove.includes(role) && !hasMemberRole(role));
		preparedRemove = rolesForRemove.filter((role) => hasMemberRole(role));
	}

	// remove duplicates
	preparedAdd = preparedAdd.filter((role, i) => preparedAdd.indexOf(role) === i);
	preparedRemove = preparedRemove.filter((role, i) => preparedRemove.indexOf(role) === i);

	return { preparedAdd, preparedRemove };
};

module.exports.removeMessagesAfterDate = async (channel, date) => {
	let messages = await channel.messages.fetch({ limit: 100 });
	messages = messages.filter((msg) => msg.createdTimestamp > date);

	await channel.bulkDelete(messages);
};

module.exports.generateRandomKey = () => {
	return "_id" + Math.round(Math.random() * 10 ** 9);
};

module.exports.getDateFormatted = (date) => {
	const adminOffset = -180;
	const offset = date.getTimezoneOffset();
	date.setMinutes(date.getMinutes() + offset - adminOffset);

	let day = date.getDate();
	day = day < 10 ? "0" + day : day;

	let month = date.getMonth() + 1;
	month = month < 10 ? "0" + month : month;

	let year = date.getFullYear();

	return `${day}.${month}.${year}`;
};

module.exports.getModalAnswers = (modal, fields) => {
	const textAnswers = {};
	modal.items.forEach((item) => {
		if (item.key) {
			textAnswers[item.key] = fields.getTextInputValue(item.key);
		} else {
			textAnswers[item.label] = fields.getTextInputValue(item.label);
		}
	});

	return textAnswers;
};

module.exports.sleep = async (time) => await new Promise((resolve) => setTimeout(resolve, time));

module.exports.createEmbed = ({ description, title }) => {
	let embed = new EmbedBuilder()
		.setColor(configService.adsConfig.borderColor);

	if (title) {
		embed = embed.setTitle(title);
	}

	if (description) {
		embed = embed.setDescription(description);
	}

	return embed;
};
