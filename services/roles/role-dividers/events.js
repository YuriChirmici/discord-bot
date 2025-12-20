const { Events } = require("discord.js");
const roleDividerService = require("./index");
const { eventsEmitter, eventsNames } = require("../../../database/events");

const registerEvents = (client) => {

	// Event when a role is deleted
	client.on(Events.GuildRoleDelete, async (role) => {
		try {
			console.log(`Role deleted: ${role.name}`);
			await roleDividerService.refreshRolesGroups(client);
		} catch (err) {
			logError(err);
		}
	});

	// Event when a role is updated (name, position, etc.)
	client.on(Events.GuildRoleUpdate, async (_oldRole, newRole) => {
		try {
			if (_oldRole.name !== newRole.name) {
				await roleDividerService.resizeDividerRole(newRole);
			}

			if (_oldRole.position !== newRole.position) {
				roleDividerService.refreshRolesGroupsDebounced(client);
			}
		} catch (err) {
			logError(err);
		}
	});

	// Event for member role changes
	client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
		try {
			// Check if roles have changed
			if (oldMember.roles.cache.equals(newMember.roles.cache)) {
				return;
			}

			roleDividerService.fixMemberRolesDividersDebounced(client, newMember);
		} catch (err) {
			logError(err);
		}
	});

	eventsEmitter.on(eventsNames.ConfigChanged, async ({ oldConfig, newConfig }) => {
		try {
			const oldDividerRoleIds = oldConfig?.rolesDividers?.dividerRoleIds || [];
			const newDividerRoleIds = newConfig?.rolesDividers?.dividerRoleIds || [];

			oldDividerRoleIds.sort();
			newDividerRoleIds.sort();

			if (JSON.stringify(oldDividerRoleIds) === JSON.stringify(newDividerRoleIds)) {
				return; // No change in dividerRoleIds
			}

			await roleDividerService.refreshRolesGroups(client);
			await roleDividerService.resizeDividerRoles(client);

			console.log("Roles groups refreshed due to dividerRoleIds config change");
		} catch (err) {
			logError(err);
		}
	});
};

module.exports = {
	registerEvents
};
