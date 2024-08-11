const main = require("../config/main.json");
const ads = require("../config/ads.json");
const memberCommands = require("../config/member-commands.json");

class ConfigService {
	constructor() {
		this.init();
	}

	init() {
		Object.assign(this, {
			...main,
			...ads,
			...memberCommands,
			isDev: process.env.__DEV__ === "true",
			sitePort: 3000,
		});
	}
}

module.exports = new ConfigService();
