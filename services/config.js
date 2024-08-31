const main = require("../config/main.json");
const ads = require("../config/ads.json");
const memberCommands = require("../config/member-commands.json");

class ConfigService {
	init() {
		const config = {
			...main,
			...ads,
			...memberCommands,
			isDev: process.env.__DEV__ === "true"
		};

		if (config.deletedMessagesLogging?.channelId) {
			config.deletedMessagesLogging.channelExceptions.push(config.deletedMessagesLogging.channelId);
		}

		Object.assign(this, config);
	}
}

module.exports = new ConfigService();
