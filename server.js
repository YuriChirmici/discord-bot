const fs = require("fs");
const path = require("path");
global.rootDir = path.join(__dirname, "./");
global.srcDir = path.join(rootDir, "src");

const configService = require("./services/config");
require("./services/globals");
const { start: schedulerStart } = require("./services/scheduler");
const discordClientService = require("./services/client");
const dbService = require("./database");
const commandsService = require("./services/commands");
const messageDeletionService = require("./services/messages-deletion");
const gameTrackingService = require("./services/game-tracking");

if (!fs.existsSync(srcDir)) {
	fs.mkdirSync(srcDir);
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
