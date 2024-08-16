const main = require("../config/main.json");
const ads = require("../config/ads.json");
const memberCommands = require("../config/member-commands.json");

class ConfigService {
	constructor() {
		this.init();
	}

	init() {
		this._config = {
			...main,
			...ads,
			...memberCommands,
			isDev: process.env.__DEV__ === "true",
			sitePort: 3000,
		};

		Object.assign(this, this._config);
	}

	getPublicConfig() {
		const config = JSON.parse(JSON.stringify(this._config));
		delete config.token;
		delete config.database;

		return config;
	}
}

module.exports = new ConfigService();
