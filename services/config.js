const main = require("../config/main.json");
const ads = require("../config/ads.json");
const auth = require("../config/auth.json");

class ConfigService {
	init() {
		Object.assign(this, {
			...main,
			...ads,
			...auth,
		});
	}
}

module.exports = new ConfigService();
