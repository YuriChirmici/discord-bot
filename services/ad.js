const fs = require("fs");
const path = require("path");
const { ad: adConfig } = require("../config.json");

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

    static checkRolesForRemove(member) {
        const roles = []
    
        for (let i = 0; i < adConfig.roles.length; i++) {
            const adRole = adConfig.roles[i];
            if (adRole.save) continue;
    
            const foundRole = member.roles.cache.find((role) => role.name === adRole.name);
            if (foundRole) {
                roles.push(foundRole);
            }
        }
    
        return roles;
    }

    static async deleteAdRoles(guildId, client) {
        const guild = await client.guilds.fetch(guildId);
		const members = guild.members.cache; // TODO: проверить все ли члены видны?
		const promises = [];

		members.forEach((member) => {
			const roles = this.checkRolesForRemove(member);
			roles.forEach((role) => promises.push(member.roles.remove(role)));

		});

		await Promise.all(promises); // TODO: make 20 per sec
    }

    static addDelayedDeletion(taskData, date, name) {
        const schedulerPath = path.join(__dirname, "../data/scheduler.json");
        const scheduler = JSON.parse(fs.readFileSync(schedulerPath), "utf8");
        scheduler.tasks.push({
            name,
            executionDate: date,
            data: taskData
        });
    
        fs.writeFileSync(schedulerPath, JSON.stringify(scheduler, null, "\t"));
    }
}

module.exports = Ad;