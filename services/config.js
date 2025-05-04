const main = require("../config/main.json");
const ads = require("../config/ads.json");
const memberCommands = require("../config/member-commands.json");
const fs = require("fs");
const path = require("path");

const dotenv = require("dotenv");
dotenv.config();

class ConfigService {
	constructor() {
		this.initLocalConfig();
		this.init(); // TODO: clear init after migration
	}

	init() {
		const config = {
			...main,
			...ads,
			...memberCommands,
		};

		if (config.deletedMessagesLogging?.channelId) {
			config.deletedMessagesLogging.channelExceptions.push(config.deletedMessagesLogging.channelId);
		}

		this.config = config;
	}

	setConfig(config) {
		this.config = config;
	}

	setCookie(cookie) {
		this.localConfig.replayFetchCookie = cookie;
		this.saveLocalConfig();
	}

	initLocalConfig() {
		this.localConfigPath = path.join(__dirname, "../config/local-config.json");
		if (!fs.existsSync(this.localConfigPath)) {
			fs.writeFileSync(this.localConfigPath, JSON.stringify({}));
		}

		this.localConfig = this.getLocalConfig();
	}

	getLocalConfig() {
		const localConfig = require(this.localConfigPath);
		return {
			...localConfig,
			isDev: process.env.__DEV__ === "true",
		};
	}

	saveLocalConfig() {
		fs.writeFileSync(this.localConfigPath, JSON.stringify({
			...this.localConfig,
			isDev: undefined
		}, null, 2));
	}
}

module.exports = new ConfigService();
