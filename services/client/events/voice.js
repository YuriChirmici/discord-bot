const { Events } = require("discord.js");
const tempVoiceService = require("../../temp-voice");

const registerEvents = (client) => {
	client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
		try {
			if (oldState.channelId) {
				await tempVoiceService.leaveChannel({ state: oldState });
			}

			if (newState.channelId) {
				await tempVoiceService.joinChannel({ client, state: newState });
			}
		} catch (err) {
			logError(err);
		}
	});
};

module.exports = {
	registerEvents
};
