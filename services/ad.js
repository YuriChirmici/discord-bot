const { ad: adConfig } = require("../config.json");
const { Models } = require("../database");

class Ad {
	constructor() {
		this.deletionTaskName = "ad";
	}

	async changeRole(role, member) {
		let roleCleared = false;
		const rolesForAdd = [];
		const rolesForRemove = [];

		for (let { id } of adConfig.roles) {
			const userRole = member.roles.cache.find(r => r.id === id);
			if (role.id === id) {
				if (!userRole) {
					rolesForAdd.push(id);
					continue;
				} else {
					rolesForRemove.push(id);
					roleCleared = true;
				}
			} else if (userRole) {
				rolesForRemove.push(id);
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

	async addDelayedDeletion(taskData, date) {
		await Models.Scheduler.create({
			name: this.deletionTaskName,
			executionDate: date,
			data: taskData
		});
	}

	async runAdDeletionTasks(client) {
		const tasks = await Models.Scheduler.find({ name: this.deletionTaskName });
		const promises = tasks.map((task) => this.closeAd(task.data, client));

		await Promise.all([
			...promises,
			Models.Scheduler.deleteMany({ name: this.deletionTaskName })
		]);
	}

	getMemberAdRoles(member) {
		const roles = [];
		for (let configRole of adConfig.roles) {
			const foundRole = member.roles.cache.find((role) => role.id === configRole.id);
			if (foundRole) {
				roles.push(configRole);
			}
		}

		return roles;
	}

	async getGuildMembers(guild) {
		const members = await guild.members.fetch();
		return Array.from(members.values());
	}

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

	async deleteAdRoles(guild) {
		const [ members, dbStats ] = await Promise.all([
			this.getGuildMembers(guild),
			Models.AdStats.find({}).lean()
		]);

		const promises = [];

		for (let member of members) {
			const memberAdRoles = this.getMemberAdRoles(member);
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

	async saveStats(memberId, roles) {
		const existed = await Models.AdStats.findOne({ memberId });
		if (existed) {
			await Models.AdStats.updateOne({ memberId }, { roles });
		} else {
			await Models.AdStats.create({ memberId, roles });
		}
	}

	addStatRole(stat, role) {
		const index = adConfig.roles.findIndex(({ id }) => role.id === id);
		stat[index] = (stat[index] || 0) + 1;
	}

	async clearStats() {
		await Models.AdStats.deleteMany({});
	}

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
			for (let i = 0; i < adConfig.roles.length; i++) {
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
}

module.exports = new Ad();
