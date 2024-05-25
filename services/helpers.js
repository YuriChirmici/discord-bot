const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder
} = require("discord.js");

module.exports.createButtons = (buttonsConfig = [], { prefix }, customData = {}) => {
	let index = 0;
	let components = [];
	buttonsConfig.forEach((row) => {
		const buttons = [];
		row.forEach((btn) => {
			buttons.push(createButton({
				customId: `${prefix}_${JSON.stringify({	index, ...customData })}`,
				prefix,
				...btn,
			}));
			index++;
		});

		components.push(new ActionRowBuilder().addComponents(...buttons));
	});

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
	options.forEach(({ text, description, value, emoji, isDefault }) => {
		let option = new StringSelectMenuOptionBuilder()
			.setLabel(text)
			.setValue(value);

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
