const fs = require("fs");
const path = require("path");
require("./services/globals");
const { start: schedulerStart } = require("./services/scheduler");
const clientService = require("./services/client");
const { connect: dbConnect } = require("./database");
const configService = require("./services/config");
const commandsService = require("./services/commands");

const isDev = process.env.__DEV__ === "true";

const srcPath = path.join(__dirname, "./src");
if (!fs.existsSync(srcPath)) {
	fs.mkdirSync(srcPath);
}

(async () => {
	try {
		configService.init();
		commandsService.init();
		if (!isDev) {
			await commandsService.deployCommands();
		}
		await clientService.login();
		await dbConnect();
		schedulerStart(clientService.getClient());
	} catch (err) {
		logError(err);
	}
})();
