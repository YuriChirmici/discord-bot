const fs = require("fs");
const path = require("path");
const configService = require("./config");
const { Models } = require("../database");
const { getButtonsFlat, getDomByUrl, setRoles, getDateFormatted, deleteDuplicates } = require("./helpers");
const profileService = require("./profile");

const srcPath = path.join(__dirname, "../src");
const nicknamesFilePath = path.join(srcPath, "nicknames.csv");

class Ad {
	constructor() {
		this.deletionTaskName = "ad";
		this.inactiveStatIndex = 99;
		this.attendanceConfigName = "attendance";
		this.commandsConfigName = "memberCommands";
	}

	async changeRoleButton({ member, adConfig, buttonIndex }) {
		let roleCleared = false;
		const rolesForAdd = [];
		const rolesForRemove = [];
		const configButtons = getButtonsFlat(adConfig.buttons);

		for (let i = 0; i < configButtons.length; i++) {
			const rolesAdd = configButtons[i].rolesAdd;
			const hasRoles = !!member.roles.cache.find(r => rolesAdd.includes(r.id));
			if (buttonIndex === i) {
				if (hasRoles) {
					rolesForRemove.push(...rolesAdd);
					roleCleared = true;
				} else {
					rolesForAdd.push(...rolesAdd);
				}
			} else if (!adConfig.multipleRoles && hasRoles) {
				rolesForRemove.push(...rolesAdd);
			}
		}

		if (rolesForRemove.length) {
			await member.roles.remove(rolesForRemove);
		}

		if (rolesForAdd.length) {
			await member.roles.add(rolesForAdd);
		}

		return roleCleared;
	}

	// for attendance ad
	async addDelayedDeletion(taskData, date) {
		await Models.Scheduler.create({
			name: this.deletionTaskName,
			executionDate: date,
			data: taskData
		});
	}

	// for attendance ad
	async runAdDeletionTasks(client, options = {}) {
		const tasks = await Models.Scheduler.find({ name: this.deletionTaskName });
		const promises = tasks.map((task) => this.closeAd(task.data, client, options));

		await Promise.all([
			...promises,
			Models.Scheduler.deleteMany({ name: this.deletionTaskName })
		]);
	}

	getMemberAdRoles(member, adName) {
		const roles = [];
		const adConfig = this.getAdConfigByName(adName);
		const configButtons = getButtonsFlat(adConfig.buttons);
		for (let button of configButtons) {
			const foundRole = member.roles.cache.find((role) => button.rolesAdd.includes(role.id));
			if (foundRole) {
				roles.push(...(button.rolesAdd.map((id) => ({ id, save: button.save }))));
			}
		}

		return roles;
	}

	async getGuildMembers(guild) {
		const members = await guild.members.fetch();
		return Array.from(members.values());
	}

	// for attendance ad
	async closeAd({ guildId, messageId, channelId }, client, options = {}) {
		const guild = await client.guilds.fetch(guildId);
		if (!options.withoutRolesClear) {
			await this.deleteAdRoles(guild);
		}

		if (channelId && messageId) {
			try {
				const channel = await client.channels.fetch(channelId);
				const message = await channel.messages.fetch(messageId);
				await message.delete();
			} catch (err) {
				if (![ "Unknown Channel", "Unknown Message" ].includes(err.message)) {
					logError(err);
				}
			}
		}
	}

	// for attendance ad
	async deleteAdRoles(guild) {
		const [ members, dbStats ] = await Promise.all([
			this.getGuildMembers(guild),
			Models.AdStats.find({}).lean()
		]);

		const promises = [];

		for (let member of members) {
			const memberAdRoles = this.getMemberAdRoles(member, this.attendanceConfigName);
			const memberStat = dbStats.find(({ memberId }) => memberId === member.id)?.roles || {};
			const rolesForRemove = [];

			if (memberAdRoles.length) {
				for (let role of memberAdRoles) {
					if (!role.save) {
						rolesForRemove.push(role.id);
					}

					this.addStatRole(memberStat, role);
				}
			} else if (this._checkInactive(member)) {
				memberStat[this.inactiveStatIndex] = (memberStat[this.inactiveStatIndex] || 0) + 1;
			}

			if (Object.keys(memberStat).length) {
				promises.push(this.saveStats(member.id, memberStat));
			}

			if (rolesForRemove.length) {
				promises.push(member.roles.remove(rolesForRemove));
			}
		}

		await Promise.all(promises);
	}

	_checkInactive(member) {
		const { rolesSelectors, rolesExceptions } = this.getAdConfigByName(this.attendanceConfigName).statisticsData;
		const foundSelector = member.roles.cache.find((role) => rolesSelectors.includes(role.id));
		const foundException = member.roles.cache.find((role) => rolesExceptions.includes(role.id));
		if (!foundSelector || foundException) {
			return false;
		}

		return true;
	}

	// for attendance ad
	async saveStats(memberId, roles) {
		await Models.AdStats.updateOne({ memberId }, { memberId, roles }, { upsert: true });
	}

	// for attendance ad
	addStatRole(stat, role) {
		const attendanceConfig = this.getAdConfigByName(this.attendanceConfigName);
		const index = getButtonsFlat(attendanceConfig.buttons).findIndex(({ rolesAdd }) => rolesAdd.includes(role.id));
		stat[index] = (stat[index] || 0) + 1;
	}

	// for attendance ad
	async clearStats() {
		await Models.AdStats.deleteMany({});
	}

	// for attendance ad
	async getStatistics(members) {
		const stat = {};
		const dbStat = await Models.AdStats.find({}).lean();

		for (let item of dbStat) {
			const member = members.find(({ id }) => id === item.memberId);
			if (!member) {
				continue;
			}

			const userKey = (member.user.globalName || member.user.username || "").toLowerCase();
			stat[userKey] = this._prepareRolesStats(item, member);
		}

		const keys = Object.keys(stat);
		keys.sort();

		const resultArr = keys.map((key) => stat[key]);

		return resultArr.join("\n");
	}

	// for attendance ad
	async getMemberStatistic(member) {
		const memberStat = await Models.AdStats.findOne({ memberId: member.id }).lean();
		return this._prepareRolesStats(memberStat, member);
	}

	// for attendance ad
	_prepareRolesStats(statItem, member) {
		const counts = [];
		const attendanceConfig = this.getAdConfigByName(this.attendanceConfigName);
		const configButtons = getButtonsFlat(attendanceConfig.buttons);
		for (let i = 0; i < configButtons.length; i++) {
			counts.push(this._getStatByIndex(statItem, i));
		}

		const inactiveCount = this._getStatByIndex(statItem, this.inactiveStatIndex);

		return `<@${member.id}> ${counts.join("/")} | ${inactiveCount}`;
	}

	_getStatByIndex(statItem, index) {
		const roles = statItem.roles || {};
		return roles[index] || roles["" + index] || 0;
	}

	getAdConfigByName(name) {
		return configService.adsConfig.ads.find((ad) => ad.name === name);
	}

	getDefaultDate() {
		const date = new Date();
		date.setMinutes(date.getMinutes() + 24 * 60);
		return getDateFormatted(date).substring(0, 5);
	}

	getRatingByDate(date) {
		const attendanceConfig = this.getAdConfigByName(this.attendanceConfigName);
		const ratings = attendanceConfig.ratings || [];
		if (!ratings.length) {
			return;
		}

		const [ day, month ] = date.split(".").map((part) => +part);
		const year = new Date().getFullYear();

		const startMonth = month % 2 === 1 ? month : month - 1;
		const startDate = new Date(year, startMonth - 1, 1, 0, 0, 0, 0);
		const currentDate = new Date(year, month - 1, day, 0, 0, 0, 0);

		const firstWeekLength = attendanceConfig.firstWeekLength || 7;

		for (let i = 0; i < ratings.length; i++) {
			let step = i === 0 ? firstWeekLength : 7;
			startDate.setDate(startDate.getDate() + step);
			if (startDate.getTime() > currentDate.getTime() || (i === ratings.length - 1)) {
				return ratings[i];
			}
		}
	}

	async getPlayersStats() {
		const statDom = await getDomByUrl("https://warthunder.com/en/community/claninfo/" + encodeURIComponent(configService.clanName));
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
				nickname: items[rowIndex + 1].textContent.trim().split("@")[0],
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

		for (let i = 1; i < rows.length; i++) {
			const parts = rows[i].split(",");
			const regType = (parts[7] || "").trim();
			if (regType !== "A") {
				continue;
			}

			const discordName = parts[1].trim();
			const gameNickname = parts[2].trim();
			if (!discordName || !gameNickname) {
				continue;
			}

			const entryDate = parts[4].trim();
			const number = Number.parseInt(parts[0].trim());

			const namePrepared = discordName[0] === "@" ? discordName.substring(1) : discordName;
			sheetStatsObj[namePrepared] ||= [];
			sheetStatsObj[namePrepared].push({
				entryDate,
				regType,
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

	async processRatingRolesUpdate(interaction) {
		const { resultText } = await this.updateRatingRoles(interaction);
		const channel = await interaction.guild.channels.fetch(configService.ratingRoles.resultChannelId);
		await channel.send(resultText);
	}

	async updateRatingRoles(interaction) {
		const [ siteStats, sheetStats, members, dbProfiles ] = await Promise.all([
			this.getPlayersStats(),
			this.getSheetStats(),
			this.getGuildMembers(interaction.guild),
			Models.Profile.find({ "sheetItem.serialNumber": { $exists: true } }).lean(), // TODO: get only needed profiles / fields ?
		]);

		if (!siteStats || !sheetStats) {
			const resultText = this.prepareRolesUpdateErrorText({ statSiteError: !siteStats, fileError: !sheetStats });
			return { resultText };
		}

		const gameAccounts = this.prepareGameAccountsData(siteStats, sheetStats, members, dbProfiles);
		const resultText = this.validateGameAccounts(gameAccounts);

		const validGameAccounts = gameAccounts.filter((acc) => !acc.hasCheckError);
		await this._updateRatingRoles(validGameAccounts);

		const groupedAccounts = {}; // group by discord acc
		validGameAccounts.filter((acc) => acc.member).forEach((acc) => {
			groupedAccounts[acc.member.id] ||= [];
			groupedAccounts[acc.member.id].push(acc);
		});

		for (let key in groupedAccounts) {
			await this._sendSheetMemberToChannel(interaction, groupedAccounts[key]);
		}

		return { resultText };
	}

	async _sendSheetMemberToChannel(interaction, accountData) {
		const { member, profile, sheetNumber } = accountData[0];
		const channelId = configService.sheetMembersChannelId;
		if (!channelId || !member) {
			return;
		}

		const compareTwoNicknameArrays = (arr1, arr2) => arr1.sort().join() === arr2.sort().join();
		const gameNicknames = accountData.map(({ gameNickname }) => gameNickname);
		const savedNicknames = (profile?.gameAccounts || []).map(({ nickname }) => nickname);
		const hasNicknamesChanged = !compareTwoNicknameArrays(gameNicknames, savedNicknames);

		const oldMessageId = profile?.sheetItem?.messageId;
		const userTag = `<@${member.user.id}>`;
		const messageText = `${sheetNumber}. ${userTag} - ${gameNicknames.join(" | ")}`;
		let message;
		if (!oldMessageId) {
			const channel = await interaction.guild.channels.fetch(channelId);
			message = await channel.send(messageText);
		} else if (hasNicknamesChanged) {
			const channel = await interaction.guild.channels.fetch(profile.sheetItem.channelId);
			message = await channel.messages.fetch(oldMessageId);
			await message.edit(messageText);
		} else {
			return;
		}

		await profileService.createOrUpdate(member.id, {
			sheetItem: {
				serialNumber: sheetNumber,
				channelId: message.channel.id,
				messageId: message.id,
			},
			gameAccounts: accountData.map(({ gameNickname, siteRating }) => ({
				nickname: gameNickname,
				lastSavedRating: siteRating,
			})),
		});
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

	prepareGameAccountsData(allSiteStats, allSheetStats, members, dbProfiles) {
		const gameAccounts = [];

		allSheetStats.forEach(({ discordName, sheetStats }) => {
			const gameNicknames = sheetStats.map(({ gameNickname }) => gameNickname);
			const siteStats = gameNicknames.map((nick) => allSiteStats.find((stat) => stat.nickname === nick)).filter(Boolean);
			const foundMember = members.find((member) => member.user.username === discordName);
			const foundProfile = foundMember ? dbProfiles.find(({ memberId }) => memberId === foundMember.id) : null;

			(sheetStats || []).forEach((sheetStat) => {
				const foundSiteStat = (siteStats || []).find(({ nickname }) => nickname === sheetStat.gameNickname);
				gameAccounts.push({
					discordName,
					member: foundMember,
					profile: foundProfile,
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

		return gameAccounts;
	}

	validateGameAccounts(gameAccounts) {
		const errors = [
			this._checkPlayersListChanges(gameAccounts),
			this._checkMissingInDiscordAcc(gameAccounts),
			this._checkMismatchEntryDate(gameAccounts),
			this._checkMismatchRole(gameAccounts),
			this._checkMismatchSerialNumber(gameAccounts),
		];

		errors.forEach(({ errorItems }) => errorItems.forEach((item) => item.hasCheckError = true));

		let errorMessage = errors.map(({ message }) => message).filter(Boolean).join("\n\n");

		return errorMessage;
	}

	getDiscordFriendlyName(name) {
		return name.replaceAll("_", "\\_");
	}

	_checkMissingInDiscordAcc(gameAccounts) {
		const errorItems = gameAccounts.filter((acc) => acc.hasSheetStat && !acc.member);

		const names = deleteDuplicates(errorItems.map(({ discordName }) => this.getDiscordFriendlyName(discordName)));
		const errorMessage = names.map((name) => `Игрок ${name} не найден в Дискорде`);

		return {
			message: errorMessage.join("\n"),
			errorItems,
		};
	}

	_checkPlayersListChanges(gameAccounts) {
		const { missingInSheetList, missingInSiteList, changedNicknameList } = this._getPlayersListChanges(gameAccounts);
		let messages = [];

		if (missingInSheetList.length) {
			const names = deleteDuplicates(missingInSheetList.map(({ gameNickname }) => gameNickname));
			messages.push(names.map((name) => `Игрок ${name} не найден в листе участников`).join("\n"));
		}

		if (missingInSiteList.length) {
			messages.push(missingInSiteList.map((item) => {
				const messageUrl = this._prepareSheetChannelMessage(item.profile?.sheetItem);
				const userStr = messageUrl ? `[${item.gameNickname}](${messageUrl})` : item.gameNickname;
				const savedRating = item.profile?.gameAccounts?.find(({ nickname }) => nickname === item.gameNickname)?.lastSavedRating;
				return [
					`Игрок ${userStr} покинул полк!`,
					savedRating ? `ЛПР - ${savedRating}` : "",
				].filter(Boolean).join(" ");
			}).join("\n"));
		}

		if (changedNicknameList.length) {
			messages.push(changedNicknameList.map(({ oldGameNickname, newGameNickname }) =>
				`Вероятно игрок ${oldGameNickname} сменил ник на ${newGameNickname}`
			).join("\n"));
		}

		return {
			message: messages.join("\n\n"),
			errorItems: [ ...missingInSheetList, ...missingInSiteList, ...changedNicknameList ],
		};
	}

	_getPlayersListChanges(gameAccounts) {
		let missingInSheetList = gameAccounts.filter((acc) => !acc.hasSheetStat && acc.hasSiteStat && acc.siteRole !== "Private");
		let missingInSiteList = gameAccounts.filter((acc) => acc.hasSheetStat && !acc.hasSiteStat);

		// if site and sheet missing items have equal entry date, then probably it's a nickname change
		const changedNicknameList = missingInSheetList.map((siteItem) => {
			const sheetStats = missingInSiteList.filter((sheetItem) => siteItem.siteEntryDate === sheetItem.sheetEntryDate);
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

	_checkMismatchEntryDate(gameAccounts) {
		const errorItems = gameAccounts.filter((acc) =>
			acc.hasSheetStat && acc.hasSiteStat && acc.sheetEntryDate !== acc.siteEntryDate
		);

		const names = deleteDuplicates(errorItems.map(({ gameNickname }) => gameNickname));
		const errorMessage = names.map((name) => `У игрока ${name} записана неверная дата вступления`);

		return {
			message: errorMessage.join("\n"),
			errorItems,
		};
	}

	_checkMismatchRole(gameAccounts) {
		const errorItems = gameAccounts.filter((acc) =>
			acc.hasSheetStat && acc.hasSiteStat && acc.siteRole === "Private"
		);

		const names = deleteDuplicates(errorItems.map(({ gameNickname }) => gameNickname));
		const errorMessage = names.map((name) => `Игроку ${name} не выдан сержант!`);

		return {
			message: errorMessage.join("\n"),
			errorItems,
		};
	}

	_checkMismatchSerialNumber(gameAccounts) {
		const errorItems = gameAccounts.filter((acc) => {
			const profileSerialNumber = acc.profile?.sheetItem?.serialNumber;
			return acc.sheetNumber && profileSerialNumber && profileSerialNumber !== acc.sheetNumber;
		});

		const errorMessage = errorItems.map((item) => {
			const messageUrl = this._prepareSheetChannelMessage(item.profile.sheetItem);
			return `[${item.gameNickname}](${messageUrl}) имеет некорректный номер в листе пользователей`;
		});

		return {
			message: errorMessage.join("\n"),
			errorItems,
		};
	}

	_prepareSheetChannelMessage(sheetItem) {
		if (!sheetItem) {
			return "";
		}

		const { channelId, messageId } = sheetItem;
		const messageUrl = `https://discord.com/channels/${configService.guildId}/${channelId}/${messageId}`;
		return messageUrl;
	}

	_prepareSheetGameAccountData(stat) {
		if (!stat) {
			return { hasSheetStat: false };
		}

		return {
			hasSheetStat: true,
			regType: stat.regType,
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
			siteRating: stat.rating,
			siteActivity: stat.activity,
			siteEntryDate: stat.entryDate,
			siteRole: stat.role,
			gameNickname: stat.nickname,
		};
	}

	async _updateRatingRoles(gameAccounts) {
		const groupedAccounts = {};
		gameAccounts
			.filter((acc) => acc.member && acc.hasSiteStat && acc.siteRole !== "Private")
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
}

const adService = new Ad();

module.exports = adService;
