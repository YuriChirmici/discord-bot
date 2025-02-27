const configService = require("../config");
const profileService = require("../profile");
const { Models } = require("../../database");
const TimersService = require("./timers");
const { fetchChannelSafe } = require("../helpers");

class GameTrackingService {
	constructor() {
		this.minMembersToTrack = 8;
		this.maxMembersToStopTrack = 5;

		this.timersService = new TimersService();
	}

	isTargetLeavingHisChannel(channelId, memberId) {
		if (!(configService.gameTracking?.trackingChannels || []).includes(channelId) || !this.isMemberTrackable(memberId)) {
			return false;
		}

		return Models.Profile.exists({ memberId, gameTrackingChannelId: channelId });
	}

	findTrackableChannelMember(channel) {
		return (channel?.members || []).find(m => this.isMemberTrackable(m));
	}

	isMemberTrackable(member) {
		const trackingRoles = configService.gameTracking?.trackingRoles || [];
		return member.roles.cache.some(r => trackingRoles.includes(r.id));
	}

	async startTracking(channelId, memberId) {
		await profileService.createOrUpdate(memberId, { gameTrackingChannelId: channelId });
	}

	async startTrackingSafe(channel) {
		if (!channel) {
			return;
		}

		if ((channel.members.size < this.minMembersToTrack) ||
			!((configService.gameTracking?.trackingChannels || []).includes(channel.id)) ||
			(await this.checkIsChannelTracking(channel.id))
		) {
			return;
		}

		const member = this.findTrackableChannelMember(channel);
		if (member) {
			await this.startTracking(channel.id, member.id);
		}
	}

	async stopTrackingMember(memberId) {
		await Models.Profile.updateOne({ memberId }, { gameTrackingChannelId: null });
	}

	async stopTrackingChannelSafe(client, channelId) {
		const timerData = this.timersService.getTimerForChannel(channelId);
		await this.stopTrackingChannel(channelId);

		if (timerData?.newChannelId) {
			const newChannel = await fetchChannelSafe(client, timerData.newChannelId);
			await this.startTrackingSafe(newChannel);
		}

		this.timersService.clearTimerForChannel(channelId);
	}

	async stopTrackingChannel(channelId) {
		await Models.Profile.updateOne({ gameTrackingChannelId: channelId }, { gameTrackingChannelId: null });
	}

	async checkIsChannelTracking(channelId) {
		return await Models.Profile.exists({ gameTrackingChannelId: channelId });
	}

	async checkIsMemberTracking(memberId) {
		return await Models.Profile.exists({ memberId, gameTrackingChannelId: { $ne: null } });
	}

	async onVoiceStateUpdate({ oldState, newState, client }) {
		if (oldState?.channel) {
			await this.leaveChannel({ oldState, newState, client });
		}

		if (newState?.channel) {
			await this.joinChannel({ oldState, newState, client });
		}
	}

	async joinChannel({ newState }) {
		const trackingChannels = configService.gameTracking?.trackingChannels || [];
		if (!trackingChannels.includes(newState.channel.id)) {
			return;
		}

		// check if target is returning to his channel
		const timerData = this.timersService.getTimerForMember(newState.member.id);
		if (timerData && timerData.channelId === newState.channel.id) {
			this.timersService.clearTimerForMember(newState.member.id);
			return;
		}

		await this.startTrackingSafe(newState.channel);
	}

	async leaveChannel({ oldState, newState, client }) {
		const trackingChannels = configService.gameTracking?.trackingChannels || [];
		if (!trackingChannels.includes(oldState.channel.id)) {
			return;
		}

		if (oldState.channel.members.size <= this.maxMembersToStopTrack) {
			await this.stopTrackingChannelSafe(client, oldState.channel.id);
		} else if (await this.isTargetLeavingHisChannel(oldState.channel.id, oldState.member.id)) {
			await this._processTargetLeavingChannel({ oldState, newState, client });
		}
	}

	async _processTargetLeavingChannel({ oldState, newState, client }) {
		const callback = async () => {
			await this.stopTrackingMember(oldState.member.id);
			if (newState && !(await this.checkIsChannelTracking(newState.channel.id))) {
				const newChannel = await fetchChannelSafe(client, newState.channel.id);
				await this.startTrackingSafe(newChannel);
			}

			const oldChannel = await fetchChannelSafe(client, oldState.channel.id);
			await this.startTrackingSafe(oldChannel);
		};

		this.timersService.startTimerForLeavingTarget(callback, {
			channelId: oldState.channel.id,
			newChannelId: newState?.channel?.id,
			memberId: oldState.member.id
		});
	}
};

module.exports = new GameTrackingService();
