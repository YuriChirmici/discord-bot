const fs = require("fs");
const path = require("path");
require("./services/globals");
const { start: schedulerStart } = require("./services/scheduler");
const discordClientService = require("./services/client");
const { connect: dbConnect } = require("./database");
const configService = require("./services/config");
const commandsService = require("./services/commands");
const siteServer = require("./site/server/server");

const srcPath = path.join(__dirname, "./src");
if (!fs.existsSync(srcPath)) {
	fs.mkdirSync(srcPath);
}

(async () => {
	try {
		configService.init();
		commandsService.init();

		const promises = [
			discordClientService.login(),
			dbConnect()
		];

		if (!configService.isDev) {
			promises.push(commandsService.deployCommands());
		}

		await Promise.all(promises);
		const discordClient = discordClientService.getClient();

		if (configService.ngrokToken && configService.logsChannelId) {
			await siteServer.init({ discordClient });
		}

		schedulerStart(discordClient);
	} catch (err) {
		logError(err);
	}
})();
