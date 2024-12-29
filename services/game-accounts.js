const fs = require("fs");
const path = require("path");
const configService = require("./config");
const { Models } = require("../database");
const { getDomByUrl, setRoles, getGuildMembers } = require("./helpers");
const profileService = require("./profile");

const srcPath = path.join(__dirname, "../src");
const nicknamesFilePath = path.join(srcPath, "nicknames.csv");

const CHECK_ERRORS = {
	missingInSheet: "missingInSheet",
	missingInSite: "missingInSite",
	changedNickname: "changedNickname",
	missingInDiscord: "missingInDiscord",
	entryDateMismatch: "entryDateMismatch",
	roleMismatch: "roleMismatch",
	serialNumberMismatch: "serialNumberMismatch",
	regimentMismatch: "regimentMismatch",
	membersSameSerialNumber: "membersSameSerialNumber",
	memberDifferentSerialNumbers: "memberDifferentSerialNumbers",
	changedDiscordName: "changedDiscordName",
};

class GameAccounts {
	async updateRatingRoles(interaction) {
		const [ siteStats, sheetStats, members, dbProfiles, nicknameSlots ] = await Promise.all([
			this.getSiteStats(),
			this.getSheetStats(),
			getGuildMembers(interaction.guild),
			Models.Profile.find({ gameAccounts: { $exists: true } }).lean(),
			Models.NicknameChannelSlot.find({ }).lean(),
		]);

		if (!siteStats || !sheetStats) {
			const resultText = this.prepareRolesUpdateErrorText({ statSiteError: !siteStats, fileError: !sheetStats });
			return { resultText };
		}

		const gameAccounts = this.prepareGameAccountsData(siteStats, sheetStats, members, dbProfiles, nicknameSlots);
		const resultText = this.validateGameAccounts(gameAccounts);

		const validGameAccounts = gameAccounts.filter((acc) => !acc.hasCheckError);
		await this._updateRatingRoles(validGameAccounts);

		const groupedAccounts = {}; // group by discord acc
		validGameAccounts.filter((acc) => acc.member).forEach((acc) => {
			groupedAccounts[acc.member.id] ||= [];
			groupedAccounts[acc.member.id].push(acc);
		});

		const nicknamesChannel = await interaction.guild.channels.fetch(configService.sheetMembersChannelId);
		for (let key in groupedAccounts) {
			const accountData = groupedAccounts[key];
			await this._updateMemberInNicknamesChannel(interaction, accountData, nicknamesChannel, nicknameSlots);
			await this._updateProfileWithGameAccountData(accountData);
		}

		await this._updateGameAccountsInactivity(gameAccounts, members);

		return { resultText };
	}

	async _updateGameAccountsInactivity(gameAccounts, members) {
		let activateMembers = [];
		let deactivateMembers = [];

		const addUnique = (arr, item) => {
			if (!arr.includes(item)) {
				arr.push(item);
			}
		};

		gameAccounts.forEach((acc) => {
			if (!acc.member) {
				return;
			}

			const regiment = this.getRegimentById(acc.regimentId);
			if (acc.errorType === CHECK_ERRORS.missingInSite || regiment?.isExcluded) {
				addUnique(deactivateMembers, acc.member);
			} else {
				addUnique(activateMembers, acc.member);
			}
		});

		const profiles = await Models.Profile.find({ gameAccounts: { $exists: true, $ne: [] } }).lean();

		for (let profile of profiles) {
			const member = members.find(({ id }) => id === profile.memberId);
			if (!member) {
				continue;
			}

			const isActive = !!profile.gameAccounts.find((acc) => {
				const foundByNickname = gameAccounts.find(({ gameNickname, hasSiteStat }) =>
					hasSiteStat && gameNickname === acc.nickname
				);
				if (foundByNickname) {
					return true;
				}

				const foundByEntryDate = gameAccounts.filter(({ hasSiteStat, siteEntryDate, regimentId }) =>
					hasSiteStat &&
					siteEntryDate === acc.entryDate &&
					regimentId === acc.regimentId
				);

				return foundByEntryDate.length === 1;
			});

			if (!isActive) {
				addUnique(deactivateMembers, member);
			}
		}

		deactivateMembers = deactivateMembers.filter((member) => !activateMembers.includes(member));

		await Promise.all([
			...activateMembers.map((member) => setRoles(member, [], configService.inactiveRoles)),
			...deactivateMembers.map((member) => setRoles(member, configService.inactiveRoles, [])),
		]);
	}

	async getSiteStats() {
		const regimentsData = await Promise.all(
			configService.regiments.map((regiment) => this._getSiteStats(regiment))
		);

		const hasMissingData = regimentsData.find((data) => !data);
		if (hasMissingData) {
			return;
		}

		const preparedRegimentsData = regimentsData.flat();

		return preparedRegimentsData;
	}

	async _getSiteStats(regiment) {
		if (regiment.isExcluded) {
			return [];
		}

		const statDom = await getDomByUrl("https://warthunder.com/en/community/claninfo/" + encodeURIComponent(regiment.name));
		const table = statDom.window.document.querySelector(".squadrons-members__table");
		if (!table) {
			return;
		}

		const items = table.querySelectorAll(".squadrons-members__grid-item");

		let data = [];
		for (let i = 1; i < items.length / 6; i++) {
			const rowIndex = i * 6;
			const dataIndex = {
				rating: 2,
				activity: 3,
				role: 4,
				entryDate: 5,
			};

			Object.keys(dataIndex).forEach((key) => dataIndex[key] = items[rowIndex + dataIndex[key]].textContent.trim());
			data.push({
				...dataIndex,
				nickname: items[rowIndex + 1].textContent.trim().replace(/\s+/g, " ").split("@")[0],
				regimentId: regiment.id,
			});
		}

		return data;
	}

	async getSheetStats() {
		if (!fs.existsSync(nicknamesFilePath)) {
			return;
		}

		const nicknamesCSV = await fs.promises.readFile(nicknamesFilePath, "utf-8");
		if (!nicknamesCSV) {
			return;
		}

		const rows = nicknamesCSV.split("\n");
		const sheetStatsObj = {};

		for (let i = 0; i < rows.length; i++) {
			const parts = rows[i].split(",");
			const sheetItemLetter = (parts[7] || "").trim();
			const accountRegiment = this.getRegimentByLetter(sheetItemLetter);
			if (!accountRegiment) {
				continue;
			}

			const discordName = parts[1].trim();
			const gameNickname = parts[2].trim();
			if (!discordName || !gameNickname) { // row is invalid
				continue;
			}

			const [ entryDate, sheetSiteEntryDate ] = parts[4].trim().split("/").map((part) => part.trim());
			const number = Number.parseInt(parts[0].trim());

			const namePrepared = discordName[0] === "@" ? discordName.substring(1) : discordName;
			sheetStatsObj[namePrepared] ||= [];
			sheetStatsObj[namePrepared].push({
				entryDate: sheetSiteEntryDate || entryDate, // sheetSiteEntryDate uses if game entry date and site entry date are different
				regimentId: accountRegiment.id,
				number,
				gameNickname,
			});
		}

		const sheetStatsArray = Object.entries(sheetStatsObj).map(([ discordName, sheetStats ]) => ({
			discordName,
			sheetStats,
		}));

		return sheetStatsArray;
	}

	async _updateMemberInNicknamesChannel(interaction, accountData, nicknamesChannel, allDbSlots) {
		const { member, profile, sheetNumber } = accountData[0];

		const gameNicknames = accountData.map(({ gameNickname }) => gameNickname);
		const savedNicknames = (profile?.gameAccounts || []).map(({ nickname }) => nickname);
		const hasNicknamesChanges = !this._compareTwoNicknameArrays(gameNicknames, savedNicknames);
		const existingSlot = allDbSlots.find(({ serialNumber }) => serialNumber == sheetNumber);

		const nicknamesText = gameNicknames.map((name) => this.getDiscordFriendlyName(name)).join(" | ");
		const slotContent = `<@${member.user.id}> - ${nicknamesText}`;
		const messageText = this._prepareNicknameSlotMessage(sheetNumber, slotContent);

		if (existingSlot?.memberId) {
			if (existingSlot.memberId !== member.id) {
				throw new Error(`Slot ${sheetNumber} is already taken by member: ${existingSlot.memberId}. New member: ${member.id}`);
			}

			if (hasNicknamesChanges) {
				const channel = nicknamesChannel.id == existingSlot.channelId
					? nicknamesChannel
					: await interaction.guild.channels.fetch(existingSlot.channelId);
				const message = await channel.messages.fetch(existingSlot.messageId);
				try {
					await message.edit(messageText);
				} catch (err) {
					logError(err);
				}
			}
		} else if (existingSlot) {
			const channel = nicknamesChannel.id == existingSlot.channelId
				? nicknamesChannel
				: await interaction.guild.channels.fetch(existingSlot.channelId);
			const message = await channel.messages.fetch(existingSlot.messageId);
			try {
				await message.edit(messageText);
			} catch (err) {
				logError(err);
			}
		} else {
			await this.createNewNicknameSlot({
				memberId: member.id,
				serialNumber: sheetNumber,
				channel: nicknamesChannel,
				messageText,
			});
		}
	}

	async _updateProfileWithGameAccountData(accountData) {
		const member = accountData[0].member;

		await profileService.createOrUpdate(member.id, {
			gameAccounts: accountData.map(({ gameNickname, siteRating, regimentId, siteEntryDate }) => ({
				nickname: gameNickname,
				entryDate: siteEntryDate,
				lastSavedRating: siteRating,
				regimentId,
			})),
			lastSheetDiscordName: member.user.username,
		});
	}

	async createNewNicknameSlot({ memberId, serialNumber, channel, messageText }) {
		const maxDBSlot = await Models.NicknameChannelSlot.findOne().sort({ serialNumber: -1 }).lean();
		const maxDBNumber = maxDBSlot?.serialNumber || 0;
		const channelId = channel.id;

		for (let i = maxDBNumber + 1; i < serialNumber; i++) {
			const emptySlotMessage = this._prepareNicknameSlotMessage(i);
			const message = await channel.send(emptySlotMessage);
			await Models.NicknameChannelSlot.create({
				serialNumber: i,
				channelId,
				messageId: message.id
			});
		}

		const message = await channel.send(messageText);

		await Models.NicknameChannelSlot.create({
			memberId,
			serialNumber,
			channelId,
			messageId: message.id
		});
	}

	_prepareNicknameSlotMessage(number, content = "") {
		return `${number}. ${content}`.trim();
	}

	prepareRolesUpdateErrorText({ statSiteError, fileError }) {
		let message = "Ошибка обновления рейтинговых ролей. Причина:\n";
		if (statSiteError) {
			message += "Ошибка сайта\n";
		}

		if (fileError) {
			message += "Ошибка файла\n";
		}

		return message.trim();
	}

	prepareGameAccountsData(allSiteStats, allSheetStats, members, dbProfiles, nicknameSlots) {
		const gameAccounts = [];

		allSheetStats.forEach(({ discordName, sheetStats }) => {
			const siteStatsForNicknames = sheetStats.map(({ gameNickname }) =>
				allSiteStats.find((stat) => stat.nickname === gameNickname)
			).filter(Boolean);
			let foundMember = members.find((member) => member.user.username === discordName);
			let foundProfile;
			if (foundMember) {
				foundProfile = dbProfiles.find(({ memberId }) => memberId == foundMember.id);
			} else {
				foundProfile = dbProfiles.find(({ lastSheetDiscordName }) => lastSheetDiscordName === discordName);
				foundMember = members.find(({ id }) => id === foundProfile?.memberId);
			}

			const foundNicknameSlot = foundMember ? nicknameSlots.find(({ memberId }) => memberId == foundMember.id) : null;

			(sheetStats || []).forEach((sheetStat) => {
				const foundSiteStat = siteStatsForNicknames.find(({ nickname }) => nickname === sheetStat.gameNickname);
				gameAccounts.push({
					discordName,
					member: foundMember,
					profile: foundProfile,
					nicknameSlot: foundNicknameSlot,
					...this._prepareSheetGameAccountData(sheetStat),
					...this._prepareSiteGameAccountData(foundSiteStat),
				});
			});
		});

		// add site stats which doesn't have sheet stats
		allSiteStats.forEach((stat) => {
			const alreadyAdded = gameAccounts.find(({ gameNickname }) => gameNickname === stat.nickname);
			if (!alreadyAdded) {
				gameAccounts.push({ ...this._prepareSiteGameAccountData(stat) });
			}
		});

		// sort by sheet number ascending
		gameAccounts.sort((a, b) => a.sheetNumber - b.sheetNumber);

		return gameAccounts;
	}

	_prepareSheetGameAccountData(stat) {
		if (!stat) {
			return { hasSheetStat: false };
		}

		return {
			hasSheetStat: true,
			regimentId: stat.regimentId,
			sheetRegimentId: stat.regimentId,
			sheetEntryDate: stat.entryDate,
			sheetNumber: stat.number,
			gameNickname: stat.gameNickname,
		};
	}

	_prepareSiteGameAccountData(stat) {
		if (!stat) {
			return { hasSiteStat: false };
		}

		return {
			hasSiteStat: true,
			regimentId: stat.regimentId,
			siteRegimentId: stat.regimentId,
			siteRating: stat.rating,
			siteActivity: stat.activity,
			siteEntryDate: stat.entryDate,
			siteRole: stat.role,
			gameNickname: stat.nickname,
		};
	}

	// #region Checks
	validateGameAccounts(gameAccounts) {
		const errors = [];

		this._checkPlayersListChanges(gameAccounts, errors);
		this._checkMissingInDiscordAcc(gameAccounts, errors);
		// this._checkMismatchEntryDate(gameAccounts, errors);
		this._checkMismatchRole(gameAccounts, errors);
		this._checkMismatchSerialNumber(gameAccounts, errors);
		this._checkMismatchRegiment(gameAccounts, errors);
		this._checkMembersSameSerialNumber(gameAccounts, errors);
		this._checkMemberDifferentSerialNumbers(gameAccounts, errors);
		this._checkChangedDiscordName(gameAccounts, errors);

		// group errors by regiment id
		const regimentErrors = {};
		errors.forEach(({ errorItems, message }) => {
			errorItems.forEach((item) => item.hasCheckError = true);
			const regimentIds = errorItems.map(({ regimentId }) => regimentId);
			regimentIds.forEach((id) => {
				regimentErrors[id] ||= [];
				if (!regimentErrors[id].includes(message)) {
					// prevent duplicates
					regimentErrors[id].push(message);
				}
			});
		});

		let resultMessage = "";
		for (let id in regimentErrors) {
			const regiment = this.getRegimentById(id);
			const header = regiment.shortName || regiment.name;
			const regimentErrorsList = regimentErrors[id].join("\n");
			resultMessage += `**${header}**\n${regimentErrorsList}\n\n`;
		}

		return resultMessage.trim();
	}

	_checkPlayersListChanges(gameAccounts, errors) {
		const { missingInSheetList, missingInSiteList, changedNicknameList } = this._getPlayersListChanges(gameAccounts);

		missingInSheetList.forEach((item) => {
			item.errorType = CHECK_ERRORS.missingInSheet;
			const name = `**${this.getDiscordFriendlyName(item.gameNickname)}**`;
			errors.push({
				message: `Игрок ${name} не найден в листе участников`,
				errorItems: [ item ],
			});
		});

		missingInSiteList.forEach((item) => {
			item.errorType = CHECK_ERRORS.missingInSite;
			const messageUrl = this._prepareSlotChannelMessage(item.nicknameSlot);
			const name = this.getDiscordFriendlyName(item.gameNickname);
			const userStr = messageUrl ? `[${name}](${messageUrl})` : `**${name}**`;

			const savedRating = item.profile?.gameAccounts?.find(
				({ nickname }) => nickname === item.gameNickname
			)?.lastSavedRating;

			const message = [
				`Игрок ${userStr} покинул полк`,
				savedRating ? `ЛПР - ${savedRating}` : "",
			].filter(Boolean).join(" ");

			errors.push({
				message,
				errorItems: [ item ],
			});
		});

		changedNicknameList.forEach((item) => {
			item.errorType = CHECK_ERRORS.changedNickname;
			const oldName = `**${this.getDiscordFriendlyName(item.oldGameNickname)}**`;
			const newName = `**${this.getDiscordFriendlyName(item.newGameNickname)}**`;
			errors.push({
				message: `Вероятно игрок ${oldName} сменил ник на ${newName}`,
				errorItems: [ item ],
			});
		});
	}

	_getPlayersListChanges(gameAccounts) {
		let missingInSheetList = gameAccounts.filter((acc) => !acc.hasSheetStat && acc.hasSiteStat && acc.siteRole !== "Private");
		let missingInSiteList = gameAccounts.filter((acc) => {
			const regiment = this.getRegimentById(acc.regimentId);
			return acc.hasSheetStat && !acc.hasSiteStat && !regiment?.isExcluded;
		});

		// if site and sheet missing items have equal entry date, then probably it's a nickname change
		const changedNicknameList = missingInSheetList.map((siteItem) => {
			const sheetStats = missingInSiteList.filter((sheetItem) => (
				siteItem.siteEntryDate === sheetItem.sheetEntryDate &&
				sheetItem.regimentId === siteItem.regimentId
			));
			if (sheetStats.length !== 1) {
				return;
			}

			const sheetItem = sheetStats[0];
			const nicknameChangesData = {
				oldGameNickname: sheetItem.gameNickname,
				newGameNickname: siteItem.gameNickname,
			};

			const newItem = {
				...siteItem,
				...sheetItem,
				...nicknameChangesData
			};

			[ sheetItem, siteItem ].forEach((item) => {
				item.hasCheckError = true;
				item.nicknameChangesData = nicknameChangesData;
			});

			return newItem;
		}).filter(Boolean);

		// remove items which are in changedNicknameList. Sheet has old nickname, site has new
		missingInSheetList = missingInSheetList.filter((item) =>
			!changedNicknameList.find(({ newGameNickname }) => newGameNickname === item.gameNickname)
		);

		// remove items which are in changedNicknameList. Sheet has old nickname, site has new
		missingInSiteList = missingInSiteList.filter((item) =>
			!changedNicknameList.find(({ oldGameNickname }) => oldGameNickname === item.gameNickname)
		);

		return {
			missingInSheetList,
			missingInSiteList,
			changedNicknameList,
		};
	}

	_checkMissingInDiscordAcc(gameAccounts, errors) {
		const errorItems = gameAccounts.filter((acc) => acc.hasSheetStat && !acc.member);
		errorItems.forEach((item) => {
			item.errorType = CHECK_ERRORS.missingInDiscord;
			const name = `**${this.getDiscordFriendlyName(item.discordName)}**`;
			errors.push({
				message: `Игрок ${name} не найден в Дискорде`,
				errorItems: [ item ],
			});
		});
	}

	_checkMismatchEntryDate(gameAccounts, errors) {
		const errorItems = gameAccounts.filter((acc) =>
			acc.hasSheetStat && acc.hasSiteStat && acc.sheetEntryDate !== acc.siteEntryDate
		);

		errorItems.forEach((item) => {
			item.errorType = CHECK_ERRORS.entryDateMismatch;
			const name = `**${this.getDiscordFriendlyName(item.gameNickname)}**`;
			errors.push({
				message: `У игрока ${name} записана неверная дата вступления`,
				errorItems: [ item ],
			});
		});
	}

	_checkMismatchRole(gameAccounts, errors) {
		const errorItems = gameAccounts.filter((acc) =>
			acc.hasSheetStat && acc.hasSiteStat && acc.siteRole === "Private"
		);

		errorItems.forEach((item) => {
			item.errorType = CHECK_ERRORS.roleMismatch;
			const name = `**${this.getDiscordFriendlyName(item.gameNickname)}**`;
			errors.push({
				message: `Игроку ${name} не выдан сержант`,
				errorItems: [ item ],
			});
		});
	}

	_checkMismatchSerialNumber(gameAccounts, errors) {
		const errorItems = gameAccounts.filter((acc) => {
			const slotSerialNumber = acc.nicknameSlot?.serialNumber;
			return acc.sheetNumber && slotSerialNumber && slotSerialNumber !== acc.sheetNumber;
		});

		errorItems.forEach((item) => {
			item.errorType = CHECK_ERRORS.serialNumberMismatch;
			const messageUrl = this._prepareSlotChannelMessage(item.nicknameSlot);
			errors.push({
				message: `У игрока [${item.gameNickname}](${messageUrl}) номер в листе пользователей не совпадает с предыдущим`,
				errorItems: [ item ],
			});
		});
	}

	_checkMismatchRegiment(gameAccounts, errors) {
		const errorItems = gameAccounts.filter((acc) =>
			acc.hasSheetStat && acc.hasSiteStat && acc.siteRegimentId !== acc.sheetRegimentId
		);

		errorItems.forEach((item) => {
			item.errorType = CHECK_ERRORS.regimentMismatch;
			const name = `**${this.getDiscordFriendlyName(item.gameNickname)}**`;
			errors.push({
				message: `Игрок ${name} имеет некорректный полк в листе пользователей`,
				errorItems: [ item ],
			});
		});
	}

	_checkMembersSameSerialNumber(gameAccounts, errors) {
		const groupedByNumber = {};
		gameAccounts
			.filter((acc) => acc.sheetNumber)
			.forEach((acc) => {
				groupedByNumber[acc.sheetNumber] ||= [];
				const arr = groupedByNumber[acc.sheetNumber];
				const alreadyAddedMember = arr.find(({ discordName, member }) => {
					if (member && acc.member) {
						return member.id === acc.member.id;
					} else {
						return discordName === acc.discordName;
					}
				});
				if (!alreadyAddedMember) {
					arr.push(acc);
				}
			});

		Object.values(groupedByNumber)
			.filter((arr) => arr.length > 1)
			.forEach((arr) => {
				arr.forEach((item) => item.errorType = CHECK_ERRORS.membersSameSerialNumber);
				const names = arr.map(({ member, gameNickname, discordName }) => {
					if (member) {
						return `<@${member.user.id}>`;
					} else if (gameNickname || discordName) {
						return `**${this.getDiscordFriendlyName(gameNickname || discordName)}**`;
					} else {
						return "";
					}
				}).join(", ");

				const number = arr[0].sheetNumber;
				errors.push({
					message: `Игроки ${names} имеют одинаковые порядковые номера (${number}) в листе`,
					errorItems: arr,
				});
			});
	}

	_checkMemberDifferentSerialNumbers(gameAccounts, errors) {
		const groupedByDiscordName = {};
		gameAccounts
			.filter((acc) => acc.sheetNumber)
			.forEach((acc) => {
				const key = acc.member?.id || acc.discordName;
				groupedByDiscordName[key] ||= [];
				const arr = groupedByDiscordName[key];
				if (!arr.find(({ sheetNumber }) => sheetNumber === acc.sheetNumber)) {
					arr.push(acc);
				}
			});

		Object.values(groupedByDiscordName)
			.filter((arr) => arr.length > 1)
			.forEach((arr) => {
				arr.forEach((item) => item.errorType = CHECK_ERRORS.memberDifferentSerialNumbers);
				const numbers = arr.map(({ sheetNumber }) => sheetNumber).join(", ");
				let name = "";
				const { member, gameNickname, discordName } = arr[0];
				if (member) {
					name = `<@${member.user.id}>`;
				} else if (gameNickname || discordName) {
					name = `**${this.getDiscordFriendlyName(gameNickname || discordName)}**`;
				}

				errors.push({
					message: `Игрок ${name} имеет разные порядковые номера (${numbers}) в листе`,
					errorItems: arr,
				});
			});
	}

	_checkChangedDiscordName(gameAccounts, errors) {
		const errorItems = gameAccounts.filter((item) => {
			const savedNickname = item.profile?.lastSheetDiscordName;
			const currentNickname = item.member?.user?.username;
			return currentNickname && savedNickname && currentNickname !== savedNickname;
		});

		errorItems.forEach((item) => {
			item.errorType = CHECK_ERRORS.changedDiscordName;
			const oldName = `**${this.getDiscordFriendlyName(item.profile.lastSheetDiscordName)}**`;
			const newName = `**${this.getDiscordFriendlyName(item.member.user.username)}**`;
			errors.push({
				message: `Игрок ${oldName} сменил Дискорд никнейм на ${newName}`,
				errorItems: [ item ],
			});
		});
	}

	getDiscordFriendlyName(name) {
		return name.replaceAll("_", "\\_");
	}

	_prepareSlotChannelMessage(nicknameSlot) {
		if (!nicknameSlot) {
			return "";
		}

		const { channelId, messageId } = nicknameSlot;
		const messageUrl = `https://discord.com/channels/${configService.guildId}/${channelId}/${messageId}`;
		return messageUrl;
	}

	getRegimentById(regimentId) {
		return configService.regiments.find(({ id }) => id == regimentId);
	}

	getRegimentByLetter(letter) {
		return configService.regiments.find(({ sheetLetter }) => sheetLetter === letter);
	}

	async _updateRatingRoles(gameAccounts) {
		const groupedAccounts = {};
		gameAccounts
			.filter((acc) => acc.member && acc.hasSiteStat && acc.siteRole !== "Private")
			.filter(({ regimentId }) => {
				const regiment = this.getRegimentById(regimentId);
				return regiment?.shouldUpdateRatingRoles;
			})
			.forEach((acc) => {
				groupedAccounts[acc.member.id] ||= [];
				groupedAccounts[acc.member.id].push(acc);
			});

		const ratingLevels = configService.ratingRoles.levels || [];
		const promises = [];
		const allRatingRolesList = ratingLevels.map(({ rolesAdd }) => rolesAdd).flat().filter(Boolean);

		Object.values(groupedAccounts).forEach((accounts) => {
			const member = accounts[0].member;
			const rolesForAdd = accounts.map(({ siteRating }) => this._getRolesByRating(siteRating)).flat();
			promises.push(setRoles(member, rolesForAdd, allRatingRolesList));
		});

		await Promise.all(promises);
	}

	_getRolesByRating(rating) {
		rating = +rating;
		const ratingLevels = configService.ratingRoles.levels || [];
		let roles = [];

		for (let { from, to, rolesAdd } of ratingLevels) {
			if (rating >= from && rating <= to) {
				roles = rolesAdd || [];
				break;
			}
		}

		return roles;
	}

	_compareTwoNicknameArrays(arr1 = [], arr2 = []) {
		return arr1.sort().join() === arr2.sort().join();
	}
}

module.exports = new GameAccounts();
