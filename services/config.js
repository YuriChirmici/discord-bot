const fs = require("fs");
const path = require("path");

const dotenv = require("dotenv");
dotenv.config();

class ConfigService {
	constructor() {
		this.initLocalConfig();
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
