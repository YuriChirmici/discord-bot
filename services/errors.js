const clientService = require("./client");
const configService = require("./config");

global.logError = async (err, messageDetails = "") => {
	try {
		let message = messageDetails + (err.stack || err.message || err);
		console.log(message);

		if (!clientService.client || !message) {
			return;
		}

		const channel = await clientService.client.channels.fetch(configService.config.errorsChannelId);
		await channel.send(message.substr(0, 1990));
	} catch (err) {
		console.log(err);
	}
};
