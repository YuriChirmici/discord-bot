const clientService = require("./client");
const configService = require("./config");

global.logError = async (err) => {
	try {
		console.log(err);
		const client = clientService.getClient();
		if (!client) {
			return;
		}

		const channel = await client.channels.fetch(configService.config.errorsChannelId);
		let message = err.stack || err.message || err;

		if (message) {
			await channel.send(message.substr(0, 1990));
		}
	} catch (err) {
		console.log(err);
	}
};
