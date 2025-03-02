const configService = require("../config");
const profileService = require("../profile");
const { Models } = require("../../database");
const TimersService = require("./timers");
const replayParser = require("./replay-parser");
const replayFetchService = require("./fetch-replays");
const prepareResultService = require("./prepare-result");
const clansStoreService = require("./clans-store");
const { fetchChannelSafe, tagMember, tagChannel, createEmbed, isJoinChannel, isLeaveChannel } = require("../helpers");

class GameTrackingService {
	constructor() {
		this.minMembersToTrack = 8;
		this.maxMembersToStopTrack = 5;

		this.lastReplayRangeSeconds = 3 * 60;

		this.timersService = new TimersService();
		this.replayParser = replayParser;
		this.replayFetchService = replayFetchService;
		this.prepareResultService = prepareResultService;
		this.clansStoreService = clansStoreService;

		this.snipeGamesDefaultLimit = 5;
	}

	isTargetLeavingHisChannel(channelId, member) {
		if (!(configService.gameTracking?.trackingChannels || []).includes(channelId) || !this.isMemberTrackable(member)) {
			return false;
		}

		return Models.Profile.exists({ memberId: member.id, gameTrackingChannelId: channelId });
	}

	async findTrackableChannelMemberProfile(channel) {
		const members = (channel?.members || []).filter(m => this.isMemberTrackable(m));
		const profile = await Models.Profile.findOne({
			memberId: { $in: members.map(m => m.id) },
			gameAccounts: { $exists: true, $ne: [] },
			gameTrackingChannelId: { $exists: false }
		});

		return profile;
	}

	isMemberTrackable(member) {
		const trackingRoles = configService.gameTracking?.trackingRoles || [];
		return member.roles.cache.some(r => trackingRoles.includes(r.id));
	}

	async startTracking(channelId, profile) {
		await profileService.createOrUpdate(profile.memberId, { gameTrackingChannelId: channelId });

		const trackableNicknames = [];
		for (let gameAccount of profile.gameAccounts) {
			const regiment = configService.regiments.find(r => r.id === gameAccount.regimentId);
			if (regiment?.gamesTrackingEnabled) {
				trackableNicknames.push(gameAccount.nickname);
			}
		}

		if (!trackableNicknames.length) {
			return;
		}

		const callback = async ({ nickname, lastSessionId }) => {
			try {
			const lastReplayData = await this.getLastGameResultByPlayerNickname(nickname, lastSessionId);
			if (lastReplayData.sessionId) {
				if (lastReplayData.sessionId !== lastSessionId) {
					await this.sendTrackingLog(lastReplayData.message);
				}

				return { sessionId: lastReplayData.sessionId };
				}
			} catch (err) {
				logError(err);
			}
		};

		this.timersService.startIntervalForFetchLastReplays(callback, { memberId: profile.memberId, nicknames: trackableNicknames });

		await this.sendTrackingLog(`Начинаю отслеживать игрока ${tagMember(profile.memberId)} в канале ${tagChannel(channelId)}`);
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

		const profile = await this.findTrackableChannelMemberProfile(channel);
		if (profile) {
			await this.startTracking(channel.id, profile);
		}
	}

	async stopTrackingMember(memberId) {
		const profile = await Models.Profile.findOneAndUpdate({
			memberId,
			gameTrackingChannelId: { $exists: true }
		}, {
			$unset: { gameTrackingChannelId: "" }
		});

		if (profile) {
			await this.sendTrackingLog(`Прекращаю отслеживать игрока ${tagMember(profile.memberId)} в канале ${tagChannel(profile.gameTrackingChannelId)}`);
		}

		this.timersService.clearFetchReplayIntervalForMember(memberId);

		return { profile };
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
		const profile = await Models.Profile.findOneAndUpdate({ gameTrackingChannelId: channelId }, { $unset: { gameTrackingChannelId: "" } });
		if (profile) {
			await this.sendTrackingLog(`Прекращаю отслеживать игрока ${tagMember(profile.memberId)} в канале ${tagChannel(channelId)}`);
			this.timersService.clearFetchReplayIntervalForMember(profile.memberId);
		}
	}

	async checkIsChannelTracking(channelId) {
		return await Models.Profile.exists({ gameTrackingChannelId: channelId });
	}

	async onVoiceStateUpdate({ oldState, newState, client }) {
		if (isLeaveChannel(oldState, newState)) {
			await this.leaveChannel({ oldState, newState, client });
		}

		if (isJoinChannel(oldState, newState)) {
			await this.joinChannel({ oldState, newState, client });
		}
	}

	async joinChannel({ newState, client }) {
		const trackingChannels = configService.gameTracking?.trackingChannels || [];
		if (!trackingChannels.includes(newState.channel.id)) {
			return;
		}

		await this.setGameTrackingResultChannel(client);

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

		await this.setGameTrackingResultChannel(client);

		if (oldState.channel.members.size <= this.maxMembersToStopTrack) {
			await this.stopTrackingChannelSafe(client, oldState.channel.id);
		} else if (await this.isTargetLeavingHisChannel(oldState.channel.id, oldState.member)) {
			await this._processTargetLeavingChannel({ oldState, newState, client });
		}
	}

	async _processTargetLeavingChannel({ oldState, newState, client }) {
		const callback = async () => {
			try {
			await this.stopTrackingMember(oldState.member.id);
			if (newState?.channel && !(await this.checkIsChannelTracking(newState.channel.id))) {
				const newChannel = await fetchChannelSafe(client, newState.channel.id);
				await this.startTrackingSafe(newChannel);
			}

			const oldChannel = await fetchChannelSafe(client, oldState.channel.id);
			await this.startTrackingSafe(oldChannel);
			} catch (err) {
				logError(err);
			}
		};

		this.timersService.startTimerForLeavingTarget(callback, {
			channelId: oldState.channel.id,
			newChannelId: newState?.channel?.id,
			memberId: oldState.member.id
		});

		let message = `Игрок ${tagMember(oldState.member.id)} покинул канал ${tagChannel(oldState.channel.id)}. `;
		message += `Отслеживание будет прекращено через ${Math.round(this.timersService.leavingTargetTimerDuration / 60000)} минут`;

		await this.sendTrackingLog(message);
	}

	async getLastGameResultByPlayerNickname(nickname, lastSessionId) {
		const replayData = (await this.replayFetchService.findLastReplaysByNickname(nickname))[0];
		if (!replayData || (replayData.endTime + this.lastReplayRangeSeconds < Date.now() / 1000) || replayData.sessionId === lastSessionId) {
			return { message: "Не удалось найти реплей" };
		}

		const team1 = replayData.players.team_1;
		const team2 = replayData.players.team_2;

		const playerIds = [ ...team1, ...team2 ].map(p => p.userId);
		const parsingResult = await this.replayParser.parseReplay(replayData, playerIds);
		if (parsingResult.players.length !== this.replayParser.playersMaxLimit) {
			return { message: "Не удалось получить информацию об игроках" };
		}

		[ team1, team2 ].forEach(team => {
			team.forEach(player => {
				const parsedPlayer = parsingResult.players.find(p => p.id == player.userId);
				Object.assign(player, parsedPlayer);
			});
		});

		const clansData = await this.clansStoreService.getClanDataForReplay({ team1, team2 });
		const message = this.prepareResultService.prepareTeams(replayData, clansData);

		return { message, sessionId: replayData.sessionId };
	}

	async stopTrackingAll(client) {
		await this.setGameTrackingResultChannel(client);

		const profiles = await Models.Profile.find({ gameTrackingChannelId: { $exists: true } });
		for (let profile of profiles) {
			await this.stopTrackingChannel(profile.gameTrackingChannelId);
		}
	}

	async getCurrentTrackingInfo() {
		const profiles = await Models.Profile.find({ gameTrackingChannelId: { $exists: true } });
		if (!profiles.length) {
			return "Отслеживаемых игроков нет";
		}

		let resultText = "Отслеживаемые игроки:\n";
		for (let profile of profiles) {
			resultText += `${tagMember(profile.memberId)} в канале ${tagChannel(profile.gameTrackingChannelId)}\n`;
		}

		return resultText;
	}

	async getEnemyLastGamesStats(nickname, limit = this.snipeGamesDefaultLimit) {
		const replays = await this.replayFetchService.findLastReplaysByNickname(nickname, { limit });
		if (!replays.length) {
			return { errorMessage: "Не удалось найти реплеи" };
		}

		const enemyTeamData = [];
		const lastGameUsersIds = [ ...replays[0].players.team_1, ...replays[0].players.team_2 ].map(p => p.userId);

		for (let replay of replays) {
			const team1 = replay.players.team_1;
			const team2 = replay.players.team_2;

			const playerIds = [ ...team1, ...team2 ].map(p => p.userId);
			const parsingResult = await this.replayParser.parseReplay(replay, playerIds);
			if (parsingResult.players.length !== this.replayParser.playersMaxLimit) {
				continue;
			}

			[ team1, team2 ].forEach(team => {
				team.forEach(player => {
					const parsedPlayer = parsingResult.players.find(p => p.id == player.userId);
					Object.assign(player, parsedPlayer);
				});
			});

			const enemyTeam = [ team1, team2 ].find(team => team.some(player => player.name === nickname)) || [];
			enemyTeamData.push(...enemyTeam);
		}

		if (!enemyTeamData.length) {
			return { errorMessage: "Не удалось получить информацию об игроках" };
		}

		enemyTeamData.forEach(player => {
			if (!lastGameUsersIds.includes(player.userId)) {
				player.isReplaced = true;
			}
		});

		const { header, message } = this.prepareResultService.prepareEnemyLastGamesStats(enemyTeamData, { count: replays.length, nickname });

		return { header, message };
	}

	// #region result channel
	async setGameTrackingResultChannel(client) {
		if (this.resultChannel || !configService.gameTracking.resultChannelId) {
			return;
		}

		this.resultChannel = await fetchChannelSafe(client, configService.gameTracking.resultChannelId);
	}

	async sendTrackingLog(result) {
		if (!this.resultChannel) {
			return;
		}

		await this.resultChannel.send(result);
	}

	async sendStatInfo({ channel, header, message }) {
		const embed = createEmbed({
			title: header,
			description: message
		});

		await channel.send({ embeds: [ embed ] });
	}
};

const gameTrackingService = new GameTrackingService();

module.exports = gameTrackingService;
