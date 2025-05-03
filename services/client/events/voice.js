const { Events } = require("discord.js");
const tempVoiceService = require("../../temp-voice");
const dbService = require("../../../database");
const { isJoinChannel, isLeaveChannel } = require("../../helpers");

const registerEvents = (client) => {
	client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
		try {
			if (isLeaveChannel(oldState, newState)) {
				await tempVoiceService.leaveChannel({ state: oldState });
			}

			if (isJoinChannel(oldState, newState)) {
				await tempVoiceService.joinChannel({ client, state: newState });
			}
		} catch (err) {
			logError(err);
		}
	});

	client.on(Events.ChannelDelete, async (channel) => {
		try {
			await dbService.Models.TempVoiceChannel.deleteOne({ channelId: channel.id });
		} catch (err) {
			logError(err);
		}
	});
};

module.exports = {
	registerEvents
};
