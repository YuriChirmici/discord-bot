const { ChannelType } = require("discord.js");
const configService = require("./config");

class TempVoiceService {
	async joinChannel({ client, state }) {
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

	async leaveChannel({ state }) {
		const connection = configService.voiceConnections.find(({ categoryId }) => categoryId === state.channel.parent.id);
		if (!connection) {
			return;
		}

		if (state.channel.members.size === 0) {
			try {
				await state.channel.delete();
			} catch (err) { }
		}
	};
}

module.exports = new TempVoiceService();
