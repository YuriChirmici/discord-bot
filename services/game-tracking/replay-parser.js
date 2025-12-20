const replayFetchService = require("./fetch-replays");
const fs = require("fs");
const path = require("path");

class ReplayParser {
	constructor() {
		this.playersMaxLimit = 16;
		this.teamsSuffixes = [ "t1_", "t2_" ];
		this.replayFetchService = replayFetchService;
		this.unitsJsonPath = path.join(srcDir, "units.json");
	}

	async init() {
		await this._fetchUnits();

		this._prepareWordsList();
		this._preparePlayersStructure();
	}

	async _fetchUnits() {
		let units = [];
		if (fs.existsSync(this.unitsJsonPath)) {
			units = require(this.unitsJsonPath);
			console.warn("Using local units.json file");
		} else {
			const result = await fetch("https://api.thunderinsights.dk/v1/units/");
			units = await result.json();
			console.warn("Using remote units from API");
		}

		const unitsObj = {};

		units.forEach(unit => {
			unitsObj[unit.unit_name] = unit;
		});

		this.units = unitsObj;
	}

	_prepareWordsList() {
		this.unitsWordsList = Object.keys(this.units);
		this.playersWordsList = [];
		this.playersEndPartsWordsList = [];

		for (let i = 1; i <= this.playersMaxLimit; i++) {
			this.teamsSuffixes.forEach(teamSuffix => {
				const playerVar = this.getPlayerVar(teamSuffix, i);
				this.playersWordsList.push(playerVar);
			});

			this.playersEndPartsWordsList.push(`${i.toString().padStart(2, "0")}_0`); // 01_0, 02_0, ...
		}
	}

	_preparePlayersStructure() {
		const players = [];

		for (let i = 1; i <= this.playersMaxLimit; i++) {
			this.teamsSuffixes.forEach(teamSuffix => {
				const playerVar = this.getPlayerVar(teamSuffix, i);
				players.push({ playerVar });
			});
		}

		this.playersStructure = players;
	}

	getPlayerVar(teamSuffix, number) {
		return `${teamSuffix}player${number.toString().padStart(2, "0")}_0`;
	}

	_extractPlayersInfoFromPartWords(words, { players }) {
		for (let i = 0; i < words.length - 1; i++) {
			const unitName = words[i];
			const playerVar = words[i + 1];

			if (this.unitsWordsList.includes(unitName) && this.playersWordsList.includes(playerVar)) {
				const player = players.find((p) => p.playerVar === playerVar);
				player.unit = this._getUnitInfo(unitName);
				player.prepared = true;
			}
		}
	}

	// second wave of parsing
	_extractPlayersInfoFromPartWords2(words, { players }) {
		for (let i = 0; i < words.length - 1; i++) {
			const unitName = words[i];
			const playerVarPart = words[i + 1];
			const player = this._findPlayerByEndPart(players, playerVarPart);

			if (this.unitsWordsList.includes(unitName) &&
				this.playersEndPartsWordsList.includes(playerVarPart) &&
				!player?.prepared
			) {
				player.unit = this._getUnitInfo(unitName);
				player.prepared = true;
			}
		}
	}

	_findPlayerByEndPart(players, endPart) {
		return players.find(p => p.playerVar.endsWith(endPart));
	}

	_getUnitInfo(unitName) {
		const { unit_name, shop_name, compressed_name, country, type } = this.units[unitName];
		return { unit_name, shop_name, compressed_name, country, type };
	}

	_mergePlayersDataAndIds(players, ids) {
		if (players.length !== this.playersMaxLimit) {
			console.error("Mismatch players count and max limit, players count:", players.length);
			return;
		}

		players.sort((a, b) => a.playerVar.localeCompare(b.playerVar));
		ids.sort();

		for (let i = 0; i < players.length; i++) {
			const player = players[i];
			player.id = ids[i];
		}
	}

	_extractInfoFromPartWords(words, otherData) {
		this._extractPlayersInfoFromPartWords(words, otherData);
		this._extractPlayersInfoFromPartWords2(words, otherData);
	}

	_getFilledPlayersCount(players) {
		return players.reduce((acc, p) => acc + (p.prepared ? 1 : 0), 0);
	}

	_deleteEmptyPlayers(players) {
		let maxFilled = players.length - players.toReversed().findIndex(p => p.prepared) - 1;
		maxFilled = maxFilled < this.playersMaxLimit ? this.playersMaxLimit - 1 : maxFilled;
		return players.splice(maxFilled - this.playersMaxLimit + 1, this.playersMaxLimit);
	}

	_extractWords(str) {
		return (str.match(/\b[A-Za-z0-9_-]{3,}\b/g) || []);
	}

	_prepareExtractedWords(words) {
		const newWords = [];
		for (let i = 0; i < words.length; i++) {
			const word = words[i];
			if (!word) {
				continue;
			}

			if (i === words.length - 1) { // last word
				newWords.push(word);
				break;
			}

			const nextWord = words[i + 1];
			if (!nextWord) {
				continue;
			}

			// combine "t1_" and "11_0" to "t1_player11_0"
			if (this.teamsSuffixes.includes(word) &&
				this.playersEndPartsWordsList.some(p => nextWord.endsWith(p))
			) {
				newWords.push(`${word}player${nextWord.substring(nextWord.length - 4)}`);
				i++;
				continue;
			}

			newWords.push(word);
		}

		return newWords;
	}

	_prepareBuffersSequence(count) {
		const sequence = [];
		for (let i = 0; i <= count; i++) {
			sequence.push(i);
		}

		if (sequence.length >= 1) {
			sequence[0] = 1; // usually all info is in the part 1, so we check it first
			sequence[1] = 0;
		}

		return sequence;
	}

	prepareBufferData(buffer) {
		let stringData = buffer.toString("utf-8");
		const words = this._prepareExtractedWords(this._extractWords(stringData));

		return { words };
	}

	async parseReplay(replayData, playerIds) {
		let players = JSON.parse(JSON.stringify(this.playersStructure));

		const downloadingSequence = this._prepareBuffersSequence(replayData.partsCount);
		for (let i of downloadingSequence) {
			const buffer = await this.replayFetchService.downloadReplay(replayData.url, i);
			const { words } = this.prepareBufferData(buffer);

			this._extractInfoFromPartWords(words, { players });

			if (this._getFilledPlayersCount(players) === this.playersMaxLimit) {
				break;
			}
		}

		players.sort((a, b) => a.playerVar.localeCompare(b.playerVar));

		players = this._deleteEmptyPlayers(players);
		this._mergePlayersDataAndIds(players, playerIds);

		return { players };
	}
}

module.exports = new ReplayParser();
