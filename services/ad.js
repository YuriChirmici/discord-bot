const { adsConfig } = require("../config.json");
const { Models } = require("../database");
const { getButtonsFlat } = require("./helpers");

class Ad {
	constructor() {
		this.deletionTaskName = "ad";
		this.inactiveStatIndex = 99;
		this.attendanceConfigName = "attendance";
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
	async runAdDeletionTasks(client) {
		const tasks = await Models.Scheduler.find({ name: this.deletionTaskName });
		const promises = tasks.map((task) => this.closeAd(task.data, client));

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
	async closeAd({ guildId, messageId, channelId }, client) {
		const guild = await client.guilds.fetch(guildId);
		await this.deleteAdRoles(guild);

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

		const promisesParts = this._splitArray(promises, 40);
		for (let part of promisesParts) {
			await Promise.all(part);
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
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

	_splitArray(arr = [], limit) {
		const result = [];
		let currentPart = [];

		for (let i = 0; i < arr.length; i++) {
			const item = arr[i];
			currentPart.push(item);
			if ((i + 1) % limit === 0) {
				result.push(currentPart);
				currentPart = [];
			}
		}

		if (currentPart.length) {
			result.push(currentPart);
		}

		return result;
	}

	// for attendance ad
	async saveStats(memberId, roles) {
		const existed = await Models.AdStats.findOne({ memberId });
		if (existed) {
			await Models.AdStats.updateOne({ memberId }, { roles });
		} else {
			await Models.AdStats.create({ memberId, roles });
		}
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
		return adsConfig.ads.find((ad) => ad.name === name);
	}

	getDefaultDate() {
		const adminOffset = -180;
		const date = new Date();
		const offset = date.getTimezoneOffset();
		date.setMinutes(date.getMinutes() + offset - adminOffset + 24 * 60);

		let day = date.getDate();
		day = day < 10 ? "0" + day : day;

		let month = date.getMonth() + 1;
		month = month < 10 ? "0" + month : month;

		return `${day}.${month}`;
	}

	getRatingByDate(date) {
		const ratings = this.getAdConfigByName(this.attendanceConfigName).ratings || [];
		if (!ratings.length) {
			return;
		}

		const [ day, month ] = date.split(".").map((part) => +part);
		const year = new Date().getFullYear();

		const startMonth = month % 2 === 1 ? month : month - 1;
		const step = 7;
		const startDate = new Date(year, startMonth - 1, 1, 0, 0, 0, 0);
		const currentDate = new Date(year, month - 1, day, 0, 0, 0, 0);

		for (let i = 0; i < ratings.length; i++) {
			startDate.setDate(startDate.getDate() + step);
			if (startDate.getTime() > currentDate.getTime() || (i === ratings.length - 1)) {
				return ratings[i];
			}
		}
	}
}

module.exports = new Ad();
