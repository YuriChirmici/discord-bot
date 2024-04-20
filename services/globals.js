const path = require("path");
require("./errors");

global.sendLongMessage = async (text, sender, limit = 1990) => {
	const rows = text.split("\n");
	let currentRow = "";
	for (let row of rows) {
		const rowText = row + "\n";
		if ((currentRow + rowText).length > limit) {
			await sender(currentRow);
			currentRow = "";
		}

		currentRow += rowText;
	}

	if (currentRow) {
		await sender(currentRow);
	}
};

global.getCommandName = (filename) => {
	return path.basename(filename).split(".")[0];
};
