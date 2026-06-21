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
// const gameTrackingService = require("./services/game-tracking");
const roleDividerService = require("./services/roles/role-dividers");

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
		const discordClient = discordClientService.client;
		// await gameTrackingService.init();

		await roleDividerService.refreshRolesGroups(discordClient);
		await roleDividerService.fixRoles(discordClient);

		schedulerStart(discordClient);

		await logBotStarted(discordClient);
	} catch (err) {
		logError(err);
	}
})();

const logBotStarted = async (client) => {
	const logsChannelId = configService.config.generalLogsChannelId;
	if (!logsChannelId || configService.localConfig.isDev) {
		return;
	}

	const logChannel = await client.channels.fetch(logsChannelId);
	if (logChannel) {
		logChannel.send("Я запустился");
	}
};
