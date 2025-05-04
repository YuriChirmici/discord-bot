const fetch = require("node-fetch");
const configService = require("../config");

class ReplayFetch {
	constructor() {
		this.requestParamsBase = {
			"gameMode": [ "arcade", "realistic", "simulation" ],
			"gameType": "clanBattle",
			"techType": "all",
			"findMissionValue": "",
			"isUserOwnReplays": false,
			"rankRange": "",
			"timeRangeFrom": "",
			"timeRangeTo": "",
			"timeRangeFromDay": 8,
			"timeRangeFromMonth": 2,
			"timeRangeFromTime": "10:00",
			"timeRangeToDay": 10,
			"timeRangeToMonth": 5,
			"timeRangeToTime": "14:00",
			"limit": 1,
			"page": 1
		};
	}

	async _getReplaysInfo(params = {}) {
		const result = await fetch("https://warthunder.com/ru/api/replay", {
			headers: {
				"content-type": "application/json",
				"accept": "application/json, text/plain, */*",
				"accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
				"cache-control": "no-cache",
				"pragma": "no-cache",
				"priority": "u=1, i",
				"sec-ch-ua": "\"Not(A:Brand\";v=\"99\", \"Google Chrome\";v=\"133\", \"Chromium\";v=\"133\"",
				"sec-ch-ua-arch": "\"x86\"",
				"sec-ch-ua-bitness": "\"64\"",
				"sec-ch-ua-full-version": "\"133.0.6943.142\"",
				"sec-ch-ua-full-version-list": "\"Not(A:Brand\";v=\"99.0.0.0\", \"Google Chrome\";v=\"133.0.6943.142\", \"Chromium\";v=\"133.0.6943.142\"",
				"sec-ch-ua-mobile": "?0",
				"sec-ch-ua-model": "\"\"",
				"sec-ch-ua-platform": "\"Windows\"",
				"sec-ch-ua-platform-version": "\"10.0.0\"",
				"sec-fetch-dest": "empty",
				"sec-fetch-mode": "cors",
				"sec-fetch-site": "same-origin",
				"Referer": "https://warthunder.com/en/tournament/replay/",
				"Referrer-Policy": "no-referrer-when-downgrade",
				"cookie": configService.config.gameTracking.replayFetchCookie,
			},
			method: "POST",
			body: JSON.stringify({
				...this.requestParamsBase,
				...params,
			}),
		});

		try {
			const json = await result.json();

			if (this.isCookieExpired(json)) {
				throw new Error("Replay cookie is expired");
			}

			this.fetchReplayErrorLogged = false;

			return json;
		} catch (err) {
			if (this.fetchReplayErrorLogged) {
				console.error(err);
			} else {
				logError("Site error, failed to fetch replays");
				this.fetchReplayErrorLogged = true;
			}

			return {};
		}
	}

	async downloadReplay(baseUrl, index) {
		const partName = `${index.toString().padStart(4, "0")}.wrpl`;
		const result = await fetch(`${baseUrl}${partName}`);
		const buffer = await result.buffer();

		return buffer;
	}

	async findLastReplaysByNickname(nickname, query = {}) {
		const replaysInfo = await this._getReplaysInfo({
			findUserValue: nickname,
			findUserType: "USERNAME", // "ID" / "USERNAME"
			...query,
		});

		return (replaysInfo.items || []).slice(0, query.limit || 1).filter(Boolean);
	}

	isCookieExpired(result) {
		return result.offset === 0 && result.limit === 0 && result.items.length === 0;
	}
}

module.exports = new ReplayFetch();
