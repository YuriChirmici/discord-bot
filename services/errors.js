const clientService = require("./client");
const configService = require("./config");

global.logError = async (err) => {
	try {
		console.log(err);
		const client = clientService.getClient();
		const channel = await client.channels.fetch(configService.errorsChannelId);
		const message = err.stack || err.message || err;
		if (message) {
			await channel.send(message);
		}
	} catch (err) {
		console.log(err);
	}
};
