const { ChannelType } = require("discord.js");
const configService = require("../config");
const dbService = require("../../database");

class TempVoiceService {
	constructor() {
		this.defaultOwnerPermissions = [ "ManageChannels", "ViewChannel", "ManageRoles", "Connect", "MoveMembers" ];
		this.defaultBotPermissions = [ "ManageChannels", "ViewChannel", "Connect", "ManageRoles" ];
	}

	async joinChannel({ state }) {
		const guild = state.guild;
		const creatingChannelId = state.channelId;
		const connection = configService.config.voiceConnections.find(({ channelId }) => channelId === creatingChannelId);
		if (!connection) {
			return;
		}

		const memberId = state.member.id;
		const categoryId = connection.categoryId;
		const isPrivate = connection.isPrivate || false;
		const position = connection.position || "bottom";

		let savedSettings = (await this.getSavedSettings({ creatingChannelId, memberId })) || {
			name: connection.channelName,
			userLimit: 10,
			permissions: []
		};

		const savedPermissions = savedSettings.permissions;
		const permissionOverwrites = await this.prepareChannelPermissions({ guild, categoryId, memberId, savedPermissions, isPrivate });

		const channel = await guild.channels.create({
			type: ChannelType.GuildVoice,
			parent: categoryId,
			name: savedSettings.name,
			userLimit: savedSettings.userLimit,
			rtcRegion: savedSettings.rtcRegion,
		});

		await Promise.all([
			state.member.voice.setChannel(channel),
			dbService.Models.TempVoiceChannel.create({ channelId: channel.id, ownerId: memberId, creatingChannelId }),
		]);

		await channel.permissionOverwrites.set(permissionOverwrites);

		await this.positionChannel({ channel, categoryId, position, guild });
	};

	async prepareChannelPermissions({ guild, categoryId, memberId, savedPermissions, isPrivate }) {
		const categoryChannel = await guild.channels.fetch(categoryId);
		const categoryPermissions = this.getChannelPermissionsPretty(categoryChannel);

		const ownerPermissions = [ {
			id: memberId,
			type: 1, // for member
			allow: this.defaultOwnerPermissions,
		} ];

		const botPermissions = [ {
			id: configService.config.botMemberId,
			type: 1, // for member
			allow: this.defaultBotPermissions,
		} ];

		const everyonePermissions = isPrivate ? [ {
			id: guild.id, // @everyone role has the same ID as guild
			type: 0, // for role
			deny: [ "ViewChannel", "Connect" ],
		} ] : [];

		const channelPermissions = [
			...categoryPermissions,
			...ownerPermissions,
			...savedPermissions,
			...everyonePermissions,
			...botPermissions,
		];

		return channelPermissions;
	}

	async leaveChannel({ state }) {
		const channel = state.channel;
		const connection = configService.config.voiceConnections.find(({ categoryId }) => categoryId === channel.parent.id);
		if (!connection) {
			return;
		}

		const dbChannel = await dbService.Models.TempVoiceChannel.findOne({ channelId: channel.id });
		if (!dbChannel) {
			return;
		}

		if (dbChannel.ownerId === state.member.id) {
			await this.saveMemberSettings(dbChannel, channel);
		}

		if (channel.members.size === 0) {
			try {
				await channel.delete();
			} catch (err) {
				console.log(err);
			}
		}
	};

	async saveMemberSettings(dbChannel, channel) {
		const creatingChannelId = dbChannel.creatingChannelId;
		await dbService.Models.TempVoiceMemberSettings.deleteMany({
			creatingChannelId,
			memberId: dbChannel.ownerId
		});

		const data = {
			creatingChannelId,
			memberId: dbChannel.ownerId,
			name: channel.name,
			userLimit: channel.userLimit,
			rtcRegion: channel.rtcRegion,
			permissions: this.getChannelPermissionsPretty(channel, "itemId")
		};

		await dbService.Models.TempVoiceMemberSettings.create(data);
	}

	async positionChannel({ channel, categoryId, position, guild }) {
		let newPosition = 0;

		if (position === "bottom") {
			const lastChannelInCategory = Array.from(guild.channels.cache.values())
				.filter(ch => ch.parentId === categoryId && ch.id !== channel.id)
				.sort((a, b) => b.position - a.position)[0];

			if (lastChannelInCategory) {
				newPosition = lastChannelInCategory.position + 1;
			}
		}

		await channel.setPosition(newPosition);
	}

	getChannelPermissionsPretty(channel, idKey = "id") {
		return Array.from(channel.permissionOverwrites.cache).map(([ , overwrite ]) => ({
			[idKey]: overwrite.id,
			type: overwrite.type,
			allow: overwrite.allow.toArray(),
			deny: overwrite.deny.toArray()
		}));
	}

	async getSavedSettings({ creatingChannelId, memberId }) {
		const savedSettings = await dbService.Models.TempVoiceMemberSettings.findOne({
			creatingChannelId,
			memberId
		}).lean();

		if (!savedSettings) {
			return null;
		}

		(savedSettings.permissions || []).forEach((item) => item.id = item.itemId);

		if (savedSettings.rtcRegion === "russia") {
			savedSettings.rtcRegion = null; // temp fix, russian region is not available
		}

		return savedSettings;
	}
}

module.exports = new TempVoiceService();
