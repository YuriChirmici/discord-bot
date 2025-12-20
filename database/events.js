const EventEmitter = require("../services/event-emitter");

module.exports = {
	eventsEmitter: new EventEmitter(),
	eventsNames: {
		ConfigChanged: "ConfigChanged"
	}
};
