const { Events, ChannelType, PermissionsBitField } = require("discord.js");
const { voiceConnections } = require("../../config.json");

const joinChannel = async ({ client, state }) => {
	const guild = await client.guilds.fetch(state.guild.id);
	const connection = voiceConnections.find(({ channelId }) => channelId === state.channelId);
	if (!connection) {
		return;
	}

	const channel = await guild.channels.create({
		type: ChannelType.GuildVoice,
		name: connection.channelName,
		parent: connection.categoryId,
		permissionOverwrites: [
			{
				id: state.member.user.id,
				allow: [
					PermissionsBitField.Flags.ManageChannels,
					PermissionsBitField.Flags.ManageRoles
				],
			},
		],
	});

	await state.member.voice.setChannel(channel);
};

const leaveChannel = async ({ state }) => {
	const connection = voiceConnections.find(({ categoryId }) => categoryId === state.channel.parent.id);
	if (!connection) {
		return;
	}

	if (!Object.keys(state.channel.members).length) {
		await state.channel.delete();
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
		} catch (error) {
			logError(error);
		}
	});
}

module.exports = {
	registerEvents
}