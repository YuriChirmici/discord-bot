const path = require("path");
require("./errors");

global.sendLongMessage = async (text, sender, limit = 1990) => {
	let currentRow = "";
	for (let symbol of text) {
		currentRow += symbol;
		if (currentRow.length >= limit) {
			await sender(currentRow);
			currentRow = "";
		}
	}

	if (currentRow) {
		await sender(currentRow);
	}
};

global.getCommandName = (filename) => {
	return path.basename(filename).split(".")[0];
};

global.getDataFromCustomId = (customId = "") => {
	const dataString = customId.substring(customId.indexOf("_") + 1);
	try {
		return JSON.parse(dataString);
	} catch (err) {}
};
