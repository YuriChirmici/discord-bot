const { ChannelType } = require("discord.js");
const configService = require("./config");
const { Models } = require("../database");

class TempVoiceService {
	async joinChannel({ client, state }) {
		const guild = await client.guilds.fetch(state.guild.id);
		const connection = configService.voiceConnections.find(({ channelId }) => channelId === state.channelId);
		if (!connection) {
			return;
		}

		const memberId = state.member.id;
		const categoryId = connection.categoryId;

		let savedSettings = (await Models.TempVoiceMemberSettings.findOne({ categoryId, memberId }).lean()) || {
			name: connection.channelName,
			userLimit: 10,
			permissions: [ {
				id: memberId,
				allow: [ "ManageChannels", "ManageRoles", "Connect" ]
			} ]
		};

		const channel = await guild.channels.create({
			type: ChannelType.GuildVoice,
			parent: categoryId,
			name: savedSettings.name,
			userLimit: savedSettings.userLimit,
			rtcRegion: savedSettings.rtcRegion,
		});

		await state.member.voice.setChannel(channel);

		const ownerPermissions = savedSettings.permissions.find(({ id }) => id === memberId);
		ownerPermissions.allow.push("ManageChannels", "ManageRoles", "Connect");

		await Promise.all([
			channel.permissionOverwrites.set(savedSettings.permissions),
			Models.TempVoiceChannel.create({ channelId: channel.id, ownerId: memberId }),
		]);
	};

	async leaveChannel({ state }) {
		const connection = configService.voiceConnections.find(({ categoryId }) => categoryId === state.channel.parent.id);
		if (!connection) {
			return;
		}

		const channel = state.channel;
		if (state.channel.members.size === 0) {
			await this.saveMemberSettings(channel, connection.categoryId);

			try {
				await state.channel.delete();
			} catch (err) { }

			await Models.TempVoiceChannel.deleteOne({ channelId: channel.id });
		}
	};

	async saveMemberSettings(channel, categoryId) {
		const dbChannel = await Models.TempVoiceChannel.findOne({ channelId: channel.id });
		if (!dbChannel) {
			return;
		}

		await Models.TempVoiceMemberSettings.deleteMany({ categoryId, memberId: dbChannel.ownerId });

		const data = {
			memberId: dbChannel.ownerId,
			categoryId,
			name: channel.name,
			userLimit: channel.userLimit,
			rtcRegion: channel.rtcRegion,
			permissions: Array.from(channel.permissionOverwrites.cache).map(([ , overwrite ]) => ({
				id: overwrite.id,
				allow: overwrite.allow.toArray(),
				deny: overwrite.deny.toArray()
			}))
		};

		await Models.TempVoiceMemberSettings.create(data);
	}
}

module.exports = new TempVoiceService();
