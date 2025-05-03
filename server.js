const configService = require("./services/config");
const fs = require("fs");
const path = require("path");
require("./services/globals");
const { start: schedulerStart } = require("./services/scheduler");
const discordClientService = require("./services/client");
const dbService = require("./database");
const commandsService = require("./services/commands");
const messageDeletionService = require("./services/messages-deletion");

const srcPath = path.join(__dirname, "./src");
if (!fs.existsSync(srcPath)) {
	fs.mkdirSync(srcPath);
}

(async () => {
	try {
		commandsService.init();

		const promises = [
			discordClientService.login(),
			dbService.connect()
		];

		if (!configService.isDev) {
			promises.push(commandsService.deployCommands());
		}

		await Promise.all(promises);
		await messageDeletionService.clearAll();
		const discordClient = discordClientService.getClient();

		schedulerStart(discordClient);
	} catch (err) {
		logError(err);
	}
})();
