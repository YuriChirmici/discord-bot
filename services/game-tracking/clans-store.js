const fetch = require("node-fetch");
const configService = require("../config");

class ClansStoreService {
	constructor() {
		this.clans = [];
		if (!configService.isDev) {
			this.init();
		}
	}

	async init() {
		for (let regiment of configService.regiments) {
			if (regiment.gamesTrackingEnabled) {
				await this.refreshClanByName(regiment.name);
			}
		}
	}

	async refreshClanByName(name) {
		const regiment = configService.regiments.find(r => r.name === name && r.gamesTrackingEnabled);
		if (!regiment) {
			console.error(`Regiment ${name} not found`);
			return;
		}

		const { timestamp, clan } = await this.fetchActualClanInfo(name);
		if (clan) {
			this.updateClan(clan, timestamp);
		}

		return this.prepareClanData(clan);
	}

	updateClan(clan, timestamp) {
		this.clans = this.clans.filter(c => c.id != clan._id);
		this.clans.push({
			...this.prepareClanData(clan),
			cacheTimestamp: timestamp,
		});
	}

	prepareClanData(clan) {
		return {
			id: clan._id,
			name: clan.name,
			points: clan.astat.dr_era5_hist,
			members: clan.members.map(m => ({
				id: m.uid,
				nick: m.nick,
			})),
		};
	}

	getClanByMemberId(memberId) {
		return this.clans.find(c => c.members.some(m => m.id == memberId));
	}

	getClanByName(name) {
		return this.clans.find(c => c.name === name);
	}

	getClanById(id) {
		return this.clans.find(c => c.id === id);
	}

	async getClanDataForReplay({ team1, team2 }) {
		let ourTeamNo = 1;
		let clan = this.getClanByMemberId(team1[0].id);
		if (!clan) {
			clan = this.getClanByMemberId(team2[0].id);
			ourTeamNo = 2;
		}

		if (!clan) {
			return {};
		}

		const newClanData = await this.refreshClanByName(clan.name);
		const pointsDiff = newClanData.points - clan.points;
		const enemyMemberId = ourTeamNo === 1 ? team2[0].id : team1[0].id;
		const enemyClanData = await this.getEnemyClanDataForReplay(enemyMemberId);

		return {
			pointsDiff,
			totalPoints: newClanData.points,
			ourTeamNo,
			isWin: pointsDiff > 0,
			...enemyClanData,
		};
	}

	async getEnemyClanDataForReplay(enemyMemberId) {
		const userData = await this.fetchUserInfo(enemyMemberId);
		return {
			enemyClanTag: userData.clanTag,
			enemyClanName: userData.clanName,
		};
	}

	async fetchUserInfo(userId) {
		const result = await fetch(`https://api.thunderinsights.dk/v1/users/direct/${userId}`);
		const json = await result.json();
		return json;
	}

	async fetchClanByTag(tag) {
		const json = await this._fetchClan(tag);
		if (!json?.clan) {
			return { clan: null };
		}

		const clans = Array.isArray(json.clan) ? json.clan : [ json.clan ];
		const clan = clans.find(c => c.tagl.toLowerCase() === tag.toLowerCase());

		return { clan };
	}

	async fetchActualClanInfo(clanName, retry = 0) {
		const name = this._newNameGenerator(clanName);
		const { timestamp, clan } = await this._fetchClanInfo(name);

		if (!clan || timestamp > (Date.now() / 1000 - 60) || retry > 4) {
			return { timestamp, clan };
		}

		return await this.fetchActualClanInfo(this._newNameGenerator(clanName), retry + 1);
	}

	async _fetchClanInfo(clanName) {
		const json = await this._fetchClan(clanName);

		json.clan ||= [];

		const clans = Array.isArray(json.clan) ? json.clan : [ json.clan ];

		return {
			clan: clans.find(c => c.name.toLowerCase() === clanName.toLowerCase()),
			timestamp: json.timestamp,
		};
	}

	async _fetchClan(clan) {
		const result = await fetch(`https://api.thunderinsights.dk/v1/clans/direct/clan/search/?clan=${clan}`);
		return await result.json();
	}

	_newNameGenerator(name) {
		const intervalsIndexes = [];
		for (let i = 0; i < name.length; i++) {
			if (name[i] === " ") {
				intervalsIndexes.push(i);
			}
		}

		const letters = name.split("").filter((l) => l !== " ").map((letter) => letter.toLowerCase());
		const combinations = 2 ** letters.length - 1;

		const seed = Math.floor(Math.random() * combinations);
		const binarySeed = seed.toString(2).padStart(letters.length, "0");
		for (let i = 0; i < binarySeed.length; i++) {
			if (binarySeed[i] === "1") {
				letters[i] = letters[i].toUpperCase();
			}
		}

		intervalsIndexes.forEach((index) => {
			letters.splice(index, 0, " ");
		});

		return letters.join("");
	}
};

const clansStoreService = new ClansStoreService();

module.exports = clansStoreService;
