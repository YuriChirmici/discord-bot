const { Events } = require("discord.js");
const gameTrackingService = require("../../game-tracking");

const registerEvents = (client) => {
	client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
		try {
			await gameTrackingService.onVoiceStateUpdate({ oldState, newState, client });
		} catch (err) {
			logError(err);
		}
	});
};

module.exports = {
	registerEvents,
};
