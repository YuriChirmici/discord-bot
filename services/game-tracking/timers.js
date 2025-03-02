class TimersService {
	constructor() {
		this.targetMemberTimers = [];
		this.leavingTargetTimerDuration = 5 * 60 * 1000;

		this.targetFetchReplayIntervals = [];
		this.fetchReplayIntervalDuration = 60 * 1000;
		this.coolDownAfterSuccessFetchReplay = 200 * 1000;
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

	startIntervalForFetchLastReplays(callback, { memberId, nicknames }) {
		const callbackWrapper = async () => {
			const intervalData = this.targetFetchReplayIntervals.find((t) => t.memberId === memberId);
			if (!intervalData) {
				return;
			}

			if (intervalData.successFetchReplayDate && (Date.now() - intervalData.successFetchReplayDate < this.coolDownAfterSuccessFetchReplay)) {
				return;
			}

			let sessionId;
			const lastSessionId = intervalData.lastSessionId;
			if (intervalData.lastNickname) {
				const result = await callback({ nickname: intervalData.lastNickname, sessionId: lastSessionId });
				sessionId = result?.sessionId;
			}

			if (!sessionId) {
				nicknames = nicknames.filter((n) => n !== intervalData.lastNickname);
				for (let nickname of nicknames) {
					const result = await callback({ nickname, lastSessionId });
					sessionId = result?.sessionId;
					if (result?.sessionId) {
						intervalData.lastNickname = nickname;
						break;
					}
				}
			}

			if (sessionId) {
				intervalData.successFetchReplayDate = Date.now();
				intervalData.lastSessionId = sessionId;
			}
		};

		const interval = setInterval(callbackWrapper, this.fetchReplayIntervalDuration);

		this.targetFetchReplayIntervals.push({
			interval,
			memberId,
		});
	}

	clearFetchReplayIntervalForMember(memberId) {
		const intervalsData = this.targetFetchReplayIntervals.filter((t) => t.memberId === memberId);
		intervalsData.forEach((intervalData) => clearInterval(intervalData.interval));
		this.targetFetchReplayIntervals = this.targetFetchReplayIntervals.filter((t) => t.memberId !== memberId);
	}
}

module.exports = TimersService;
