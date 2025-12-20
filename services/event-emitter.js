const EventEmitter = require("events");

class ServicesEventEmitter extends EventEmitter {
	constructor() {
		super();
	}

	async emitAsync(eventName, ...args) {
		const listeners = this.listeners(eventName);
		const promises = listeners.map(listener => {
			try {
				const result = listener(...args);
				return Promise.resolve(result);
			} catch (err) {
				return Promise.reject(err);
			}
		});

		await Promise.all(promises);
	}
}

module.exports = ServicesEventEmitter;
