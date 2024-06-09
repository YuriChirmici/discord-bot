const main = require("../config/main.json");
const ads = require("../config/ads.json");
const memberCommands = require("../config/member-commands.json");

class ConfigService {
	init() {
		Object.assign(this, {
			...main,
			...ads,
			...memberCommands,
		});
	}
}

module.exports = new ConfigService();
