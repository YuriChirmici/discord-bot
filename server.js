const configService = require("./services/config");
const fs = require("fs");
const path = require("path");
require("./services/globals");
const { start: schedulerStart } = require("./services/scheduler");
const discordClientService = require("./services/client");
const dbService = require("./database");
const commandsService = require("./services/commands");
const messageDeletionService = require("./services/messages-deletion");
const gameTrackingService = require("./services/game-tracking");

const srcPath = path.join(__dirname, "./src");
if (!fs.existsSync(srcPath)) {
	fs.mkdirSync(srcPath);
}

if (!fs.existsSync(messageDeletionService.filesFolder)) {
	fs.mkdirSync(messageDeletionService.filesFolder);
}

(async () => {
	try {
		await dbService.connect();
		commandsService.init();

		await discordClientService.login();

		if (!configService.localConfig.isDev) {
			await commandsService.deployCommands();
		}

		await messageDeletionService.clearAll();
		const discordClient = discordClientService.getClient();
		await gameTrackingService.init();

		schedulerStart(discordClient);
	} catch (err) {
		logError(err);
	}
})();
