const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

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

module.exports.getButtonsFlat = (buttonsRows) => buttonsRows.flat();
