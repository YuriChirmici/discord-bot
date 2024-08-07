const { Events, ChannelType } = require("discord.js");
const configService = require("../../config");

const joinChannel = async ({ client, state }) => {
	const guild = await client.guilds.fetch(state.guild.id);
	const connection = configService.voiceConnections.find(({ channelId }) => channelId === state.channelId);
	if (!connection) {
		return;
	}

	const channel = await guild.channels.create({
		type: ChannelType.GuildVoice,
		name: connection.channelName,
		parent: connection.categoryId,
		userLimit: 10,
	});

	await state.member.voice.setChannel(channel);

	try {
		await channel.permissionOverwrites.create(state.member.user.id, {
			ManageChannels: true,
			ManageRoles: true,
			Connect: true
		});
	} catch (err) {
		logError(err);
	}
};

const leaveChannel = async ({ state }) => {
	const connection = configService.voiceConnections.find(({ categoryId }) => categoryId === state.channel.parent.id);
	if (!connection) {
		return;
	}

	if (state.channel.members.size === 0) {
		try {
			await state.channel.delete();
		} catch (err) {}
	}
};

const registerEvents = (client) => {
	client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
		try {
			if (oldState.channelId) {
				await leaveChannel({ state: oldState });
			}

			if (newState.channelId) {
				await joinChannel({ client,	state: newState });
			}
		} catch (err) {
			logError(err);
		}
	});
};

module.exports = {
	registerEvents
};
