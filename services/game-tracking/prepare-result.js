class PrepareResultService {
	constructor() {
		this.teamsStatInterval = 16;
		this.hiddenHieroglyph = "ㅤ";
		this.prohibitedUnitNameSymbols = [
			"▄", "␗", "◄", "", "◘", "◐", "▂",
			"◗", "◌", "◊", "▀", "'", "▅", "◔",
			"▃", "␠", "○", "⋠", "◡", "◢"
		];

		this.countryFlagsMap = {
			"USA": "US",
			"Germany": "DE",
			"USSR": "RU",
			"Great Britain": "GB",
			"Japan": "JP",
			"China": "CN",
			"Italy": "IT",
			"France": "FR",
			"Sweden": "SE",
			"Israel": "IL",
		};

		this.unitsSortOrder = [ "aircraft", "helicopter", "tank", "SPAA", "" ];
	}

	prepareTeams(replayData, clansData) {
		let { team_1: team1, team_2: team2 } = replayData.players;

		if (clansData?.ourTeamNo === 1) {
			[ team1, team2 ] = [ team2, team1 ];
		}

		this._preprocessData({ team1, team2 });
		team1 = this.sortTeam(team1);
		team2 = this.sortTeam(team2);

		const commentMark = "```";

		const { pointsDiff, totalPoints, enemyClanTag, enemyClanName } = clansData;

		const gameResult = clansData.isWin ? "Победа!" : "Поражение!";

		return [
			commentMark,
			`Session ID: ${replayData.sessionId}`,
			...(pointsDiff ? [ `${gameResult} ${totalPoints} РП (${pointsDiff > 0 ? "+" : ""}${pointsDiff})` ] : []),
			`${enemyClanTag} ${enemyClanName}\n`,
			this._prepareTeamsStat({ team1, team2 }),
			commentMark,
		].join("\n");
	}

	_preprocessData({ team1, team2 }) {
		[ team1, team2 ].forEach((team, i) => team.forEach(player => {
			player.unit = this._prepareUnit(player.unit);
			player.unitNamePrepared = this._prepareUnitName(player.unit);
			player.playerNamePrepared = this._prepareName(player.name, i === 0);
		}));
	}

	_prepareUnitName(unit, useIntervals = true) {
		let name = unit.shop_name.replace(new RegExp(this.prohibitedUnitNameSymbols.join("|"), "g"), "");
		if (name.length !== unit.shop_name.length) {
			const countryLabel = this.countryFlagsMap[unit.country] || unit.country;
			name = `(${countryLabel}) ${name}`;
		}

		if (useIntervals) {
			name = this._prepareNameWithWideSymbols(name);
		}

		return name;
	}

	_prepareName(name, isLeftTeam) {
		if (isLeftTeam) {
			name = this._prepareNameWithWideSymbols(name);
		}

		return name;
	}

	_prepareNameWithWideSymbols(name) {
		let wideSymbolsCount = this.countWideSymbols(name);
		if (wideSymbolsCount === 0) {
			return name;
		}

		const additionalHieroglyphsCount = (3 - wideSymbolsCount % 3);
		name += this.hiddenHieroglyph.repeat(additionalHieroglyphsCount);

		return name;
	}

	_calculateVisualLength(str) {
		const hieroglyphsCount = this.countWideSymbols(str);
		const visualLength = Math.round((str.length - hieroglyphsCount) + hieroglyphsCount * 5 / 3);

		return visualLength;
	}

	_prepareTeamsStat({ team1, team2 }) {
		const rows = [];

		const columns = [
			team1.slice(0, team1.length / 2),
			team1.slice(team1.length / 2),
			team2.slice(0, team2.length / 2),
			team2.slice(team2.length / 2),
		];

		const columnsWidths = columns.map((column, i) => {
			const additionalWidth = (i === columns.length / 2 - 1) ? this.teamsStatInterval : this.teamsStatInterval / 3;
			return this._calculateMaxRowLength(column) + additionalWidth;
		});

		for (let i = 0; i < columns[0].length; i++) {
			const players = columns.map(column => column[i]);
			let row1 = "";
			let row2 = "";

			for (let j = 0; j < players.length; j++) {
				const player = players[j];
				row1 += player.playerNamePrepared;
				row2 += player.unitNamePrepared;

				if (j === players.length - 1) {
					break;
				}

				const row1Len = this._calculateVisualLength(player.playerNamePrepared);
				const row2Len = this._calculateVisualLength(player.unitNamePrepared);

				const additionalSpaces1 = " ".repeat(columnsWidths[j] - row1Len);
				const additionalSpaces2 = " ".repeat(columnsWidths[j] - row2Len);

				row1 += additionalSpaces1;
				row2 += additionalSpaces2;
			}
			rows.push(row1, row2, "");
		}

		return rows.join("\n");
	}

	_calculateMaxRowLength(team1) {
		let maxRowLength = 0;
		team1.forEach(({ playerNamePrepared, unitNamePrepared }) => {
			const visualLength = this._calculateVisualLength(playerNamePrepared);
			const playerLen = Math.max(visualLength, unitNamePrepared.length);
			if (playerLen > maxRowLength) {
				maxRowLength = playerLen;
			}
		});

		return maxRowLength;
	}

	countWideSymbols(str) {
		const hieroglyphsCount = (str.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) || []).length;
		const hiddenSymbolsCount = (str.match(new RegExp(this.hiddenHieroglyph, "g")) || []).length;

    	return hieroglyphsCount + hiddenSymbolsCount;
	}

	_prepareUnitCustomType(unit) {
		if (unit?.compressed_name === "SPAA") {
			return "SPAA";
		} else {
			return unit.type;
		}
	}

	sortTeam(team) {
		team.sort((a, b) => (this.unitsSortOrder.indexOf(a.unit.unitCustomType) - this.unitsSortOrder.indexOf(b.unit.unitCustomType)));
		const column1 = [];
		const column2 = [];

		for (let i = 0; i < team.length - 1; i += 2) {
			column1.push(team[i]);
			column2.push(team[i + 1]);
		}

		return [ ...column1, ...column2 ];
	}

	prepareEnemyLastGamesStats(enemyLastGamesStats, { count, nickname }) {
		const players = this._prepareEnemyPlayers(enemyLastGamesStats);

		let nicknamesColumns = [];
		const unitsColumns = [];

		players.forEach((player) => {
			const unitsRow = player.units.map((unit) => this._prepareUnitName(unit, false)).join("; ");
			let playerRow = player.name;
			if (player.isReplaced) {
				playerRow += " (заменён)";
			}

			nicknamesColumns.push(this._prepareName(playerRow, true));
			unitsColumns.push(unitsRow);
		});

		const maxNicknamesLength = Math.max(...nicknamesColumns.map((name) => this._calculateVisualLength(name)));
		nicknamesColumns = nicknamesColumns.map((name) => {
			const spacesCount = maxNicknamesLength + 8 - this._calculateVisualLength(name);
			return name + " ".repeat(spacesCount);
		});

		let result = "";
		for (let i = 0; i < nicknamesColumns.length; i++) {
			result += `${nicknamesColumns[i]}${unitsColumns[i]}\n`;
		}

		const commentMark = "```";
		const message = [
			commentMark,
			result,
			commentMark,
		].join("\n");

		return {
			header: `Информация о последних ${count} матчах игрока "${nickname}"`,
			message,
		};
	}

	_prepareEnemyPlayers(enemyLastGamesStats) {
		const groupedByUser = {};
		enemyLastGamesStats.forEach(({ id, ...stats }) => {
			groupedByUser[id] ||= {};
			const userInfo = groupedByUser[id];

			stats.unit = this._prepareUnit(stats.unit);

			Object.assign(userInfo, {
				id,
				name: stats.name,
				playerVar: stats.playerVar,
				isReplaced: stats.isReplaced,
			});

			userInfo.units ||= [];
			if (!userInfo.units.find((u) => u.unit_name === stats.unit.unit_name)) {
				userInfo.units.push(stats.unit);
			}
		});

		const players = Object.values(groupedByUser);

		players.forEach((player) => {
			player.unitsPriority = Math.min(...(player.units.map((unit) => this.unitsSortOrder.indexOf(unit.unitCustomType))));
		});

		players.sort((a, b) => (a.unitsPriority - b.unitsPriority));
		players.sort((a, b) => (!!a.isReplaced - !!b.isReplaced));

		return players;
	}

	_prepareUnit(unit) {
		if (!unit?.shop_name) {
			unit = {
				shop_name: "Unknown",
				unit_name: "Unknown",
				type: "",
			};
		}

		unit.unitCustomType = this._prepareUnitCustomType(unit);

		return unit;
	}
}

const prepareResultService = new PrepareResultService();

module.exports = prepareResultService;
