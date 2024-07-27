const ru = require("./ru");

class LocalizationService {
	constructor() {
		this.locals = { ru };
	}

	getLocal(lang = "ru") {
		return this.locals[lang];
	}
}

module.exports = new LocalizationService();
