const { ad: adConfig } = require("../config.json");
const { Models } = require("../database");

class Ad {
	static async changeRole(newRole, member) {
		let roleCleared = false;
		const promises = [];

		for (let role of adConfig.roles) {
			const userRole = member.roles.cache.find(r => r.name === role.name);
			if (role.name !== newRole.name) {
				if (userRole) {
					promises.push(member.roles.remove(userRole));
				}
				continue;
			}

			if (userRole) {
				promises.push(member.roles.remove(userRole));
				roleCleared = true;
			} else {
				promises.push(member.roles.add(newRole));
			}
		}

		await Promise.all(promises);

		return roleCleared;
	}

	static async addDelayedDeletion(taskData, date, name) {
		await Models.Scheduler.create({
			name,
			executionDate: date,
			data: taskData
		});
	}

	static async clearDelayedDeletions() {
		await Models.Scheduler.deleteMany({ name: "ad" });
	}

	static getMemberAdRoles(member) {
		const roles = [];

		for (let i = 0; i < adConfig.roles.length; i++) {
			const adRole = adConfig.roles[i];
			const foundRole = member.roles.cache.find((role) => role.name === adRole.name);
			if (foundRole) {
				roles.push(adRole);
			}
		}

		return roles;
	}

	static async getGuildMembers(guild) {
		const members = await guild.members.fetch();
		const prepared = [];
		for (let member of members) {
			prepared.push(member[1]);
		}
		return prepared;
	}

	static async deleteAdRoles(guild, saveStat = true) {
		const members = await this.getGuildMembers(guild);
		const promises = [];
		const stat = await Models.AdStats.find({}).lean();

		for (let member of members) {
			const adRoles = this.getMemberAdRoles(member);
			const memberStat = stat.find(({ memberId }) => memberId === member.id)?.roles || {};

			for (let role of adRoles) {
				const guildRole = guild.roles.cache.find(({ name }) => role.name === name);
				if (!role.save) {
					promises.push(member.roles.remove(guildRole));
					if (promises.length % 30 === 0) {
						await new Promise(r => setTimeout(r, 1000));
					}
				}

				this.addStatRole(memberStat, role);
			}

			if (saveStat && Object.keys(memberStat).length) {
				this.saveStats(member.id, memberStat);
			}
		}

		await Promise.all(promises);
	}

	static async saveStats(memberId, roles) {
		const existed = await Models.AdStats.findOne({ memberId });
		if (existed) {
			await Models.AdStats.updateOne({ memberId }, { roles });
		} else {
			await Models.AdStats.create({ memberId, roles });
		}
	}

	static addStatRole(stat, role) {
		const index = adConfig.roles.findIndex(({ name }) => role.name === name);
		stat[index] = (stat[index] || 0) + 1;
	}

	static async clearStats() {
		await Models.AdStats.deleteMany({});
	}

	static async getStatistics(members) {
		const stat = {};
		const rawStat = await Models.AdStats.find({}).lean();

		for (let item of rawStat) {
			const member = members.find(({ id }) => id === item.memberId);
			if (!member) continue;
			const roles = item.roles || {};
			const nums = [];
			for (let i = 0; i < adConfig.roles.length; i++) {
				nums.push(roles[i] || roles["" + i] || 0);
			}

			const userKey = (member.user.globalName || member.user.username || "").toLowerCase();
			stat[userKey] = `<@${member.user.id}> ` + nums.join("/");
		}

		const keys = Object.keys(stat);
		keys.sort();

		const resultArr = keys.map((key) => stat[key]);

		return resultArr.join("\n");
	}
}

module.exports = Ad;
