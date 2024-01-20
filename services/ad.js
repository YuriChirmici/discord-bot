const fs = require("fs");
const path = require("path");
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
		const stat = saveStat && this.getRolesStat();

		for (let member of members) {
			const adRoles = this.getMemberAdRoles(member);

			for (let role of adRoles) {
				const guildRole = guild.roles.cache.find(({ name }) => role.name === name);
				if (!role.save) {
					promises.push(member.roles.remove(guildRole));
					if (promises.length % 30 === 0) {
						await new Promise(r => setTimeout(r, 1000));
					}
				}
				
				saveStat && this.addStatRole(stat.members, member.id, role);
			 };
		}

		await Promise.all(promises);

		saveStat && this.saveStats(stat);
	}

	static getRolesStat() {
		const statPath = path.join(__dirname, "../data/ad-stat.json");
		const stat = JSON.parse(fs.readFileSync(statPath), "utf8");
	
		stat ||= {};
		stat.members ||= {};
		return stat;
	}

	static addStatRole(stat, memberId, role) {
		stat[memberId] ||= {};

		const index = adConfig.roles.findIndex(({ name }) => role.name === name);
		stat[memberId][index] = (stat[memberId][index] || 0) + 1;
	}

	static saveStats(stat) {
		const statPath = path.join(__dirname, "../data/ad-stat.json");
		fs.writeFileSync(statPath, JSON.stringify(stat, null, "\t"));
	}

	static clearStats() {
		const statPath = path.join(__dirname, "../data/ad-stat.json");
		fs.writeFileSync(statPath, JSON.stringify({}, null, "\t"));
	}

	static async getStatistics(members) {
		const stat = [];
		const rawStat = this.getRolesStat().members;
		
		for (let key in rawStat) {
			const member = members.find(({ id }) => id === key);
			const roles = rawStat[key] || {};
			const nums = [];
			for (let i = 0; i < adConfig.roles.length; i++) {
				nums.push(roles[i] || roles["" + i] || 0)
			}

			stat.push(`@${member.user.username} ` + nums.join("/"));
		}

		return stat.join("\n");
	}
}

module.exports = Ad;