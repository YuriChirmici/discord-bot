const { ChannelType } = require("discord.js");
const configService = require("./config");
const { Models } = require("../database");

class TempVoiceService {
	constructor() {
		this.defaultOwnerPermissions = [ "ManageChannels", "ViewChannel", "ManageRoles", "Connect", "MoveMembers" ];
		this.defaultBotPermissions = [ "ManageChannels", "ViewChannel", "Connect", "ManageRoles" ];
	}

	async joinChannel({ client, state }) {
		const guild = await client.guilds.fetch(state.guild.id);
		const connection = configService.voiceConnections.find(({ channelId }) => channelId === state.channelId);
		if (!connection) {
			return;
		}

		const memberId = state.member.id;
		const categoryId = connection.categoryId;

		let savedSettings = (await this.getSavedSettings({ categoryId, memberId })) || {
			name: connection.channelName,
			userLimit: 10,
			permissions: []
		};

		const savedPermissions = savedSettings.permissions;
		const permissionOverwrites = await this.prepareChannelPermissions({ guild, categoryId, memberId, savedPermissions });

		const channel = await guild.channels.create({
			type: ChannelType.GuildVoice,
			parent: categoryId,
			name: savedSettings.name,
			userLimit: savedSettings.userLimit,
			rtcRegion: savedSettings.rtcRegion,
		});

		await Promise.all([
			state.member.voice.setChannel(channel),
			Models.TempVoiceChannel.create({ channelId: channel.id, ownerId: memberId }),
		]);

		await channel.permissionOverwrites.set(permissionOverwrites);
	};

	async prepareChannelPermissions({ guild, categoryId, memberId, savedPermissions, }) {
		const categoryChannel = await guild.channels.fetch(categoryId);
		const categoryPermissions = this.getChannelPermissionsPretty(categoryChannel);

		const ownerPermissions = [ {
			id: memberId,
			type: 1, // for member
			allow: this.defaultOwnerPermissions,
		} ];

		const botPermissions = [ {
			id: configService.botMemberId,
			type: 1, // for member
			allow: this.defaultBotPermissions,
		} ];

		const channelPermissions = [
			...categoryPermissions,
			...ownerPermissions,
			...savedPermissions,
			...botPermissions,
		];

		return channelPermissions;
	}

	async leaveChannel({ state }) {
		const channel = state.channel;
		const connection = configService.voiceConnections.find(({ categoryId }) => categoryId === channel.parent.id);
		if (!connection) {
			return;
		}

		const dbChannel = await Models.TempVoiceChannel.findOne({ channelId: channel.id });
		if (dbChannel?.ownerId === state.member.id) {
			await this.saveMemberSettings(channel, connection.categoryId);
		}

		if (channel.members.size === 0) {
			try {
				await channel.delete();
			} catch (err) { }
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
			permissions: this.getChannelPermissionsPretty(channel, "itemId")
		};

		await Models.TempVoiceMemberSettings.create(data);
	}

	getChannelPermissionsPretty(channel, idKey = "id") {
		return Array.from(channel.permissionOverwrites.cache).map(([ , overwrite ]) => ({
			[idKey]: overwrite.id,
			type: overwrite.type,
			allow: overwrite.allow.toArray(),
			deny: overwrite.deny.toArray()
		}));
	}

	async getSavedSettings({ categoryId, memberId }) {
		const savedSettings = await Models.TempVoiceMemberSettings.findOne({ categoryId, memberId }).lean();
		(savedSettings?.permissions || []).forEach((item) => item.id = item.itemId);

		return savedSettings;
	}
}

module.exports = new TempVoiceService();
