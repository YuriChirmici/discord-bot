class TimersService {
	constructor() {
		this.targetMemberTimers = [];
		this.leavingTargetTimerDuration = 5 * 60 * 1000;
	}

	startTimerForLeavingTarget(callback, { channelId, memberId }) {
		this.clearTimerForMember(memberId);

		const timer = setTimeout(callback, this.leavingTargetTimerDuration);

		this.targetMemberTimers.push({
			timer,
			channelId,
			memberId,
		});
	}

	getTimerForMember(memberId) {
		return this.targetMemberTimers.find((t) => t.memberId === memberId);
	}

	clearTimerForMember(memberId) {
		const timerData = this.targetMemberTimers.find((t) => t.memberId === memberId);
		if (timerData) {
			clearTimeout(timerData.timer);
			this.targetMemberTimers = this.targetMemberTimers.filter((t) => t.memberId !== memberId);
		}
	}

	getTimerForChannel(channelId) {
		return this.targetMemberTimers.find((t) => t.channelId === channelId);
	}

	clearTimerForChannel(channelId) {
		const timerData = this.targetMemberTimers.find((t) => t.channelId === channelId);
		if (timerData) {
			clearTimeout(timerData.timer);
			this.targetMemberTimers = this.targetMemberTimers.filter((t) => t.channelId !== channelId);
		}
	}
}

module.exports = TimersService;
