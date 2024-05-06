const { adsConfig } = require("../config.json");
const { Models } = require("../database");

class Ad {
	constructor() {
		this.deletionTaskName = "ad";
	}

	async changeRoleButton({ member, adConfig, buttonIndex }) {
		let roleCleared = false;
		const rolesForAdd = [];
		const rolesForRemove = [];

		for (let i = 0; i < adConfig.buttons.length; i++) {
			const rolesAdd = adConfig.buttons[i].rolesAdd;
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
		for (let button of adConfig.buttons) {
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
			const memberAdRoles = this.getMemberAdRoles(member, "attendance");
			const memberStat = dbStats.find(({ memberId }) => memberId === member.id)?.roles || {};
			const rolesForRemove = [];

			for (let role of memberAdRoles) {
				if (!role.save) {
					rolesForRemove.push(role.id);
				}

				this.addStatRole(memberStat, role);
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
		const attendanceConfig = this.getAdConfigByName("attendance");
		const index = attendanceConfig.buttons.findIndex(({ rolesAdd }) => rolesAdd.includes(role.id));
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

			const roles = item.roles || {};
			const counts = [];
			const attendanceConfig = this.getAdConfigByName("attendance");
			for (let i = 0; i < attendanceConfig.buttons.length; i++) {
				counts.push(roles[i] || roles["" + i] || 0);
			}

			const userKey = (member.user.globalName || member.user.username || "").toLowerCase();
			stat[userKey] = `<@${member.user.id}> ` + counts.join("/");
		}

		const keys = Object.keys(stat);
		keys.sort();

		const resultArr = keys.map((key) => stat[key]);

		return resultArr.join("\n");
	}

	getAdConfigByName(name) {
		return adsConfig.ads.find((ad) => ad.name === name);
	}
}

module.exports = new Ad();
