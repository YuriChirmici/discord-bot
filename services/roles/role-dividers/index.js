const configService = require("../../config");
const textResizingService = require("../../text-resizing");
const { sendLongMessage } = require("../../helpers");

class RoleDividerService {
	constructor() {
		this.rolesGroups = [];

		// Store debounce timers for each member
		this.memberUpdateTimers = new Map();
		this.DEBOUNCE_DELAY = 30_000; // 30 seconds

		// Debounce timer for refreshRolesGroups
		this.refreshRolesGroupsTimer = null;

		// Debounce for logFixChanges
		this.logFixChangesTimer = null;
		this.logFixChangesBuffer = [];
		this.LOG_DEBOUNCE_DELAY = 30_000;

		this.dividerDefaultColor = 2303016; // "#232428"
	}

	async fixRoles(client) {
		const dividerRoleIds = configService.config.rolesDividers?.dividerRoleIds || [];
		if (!dividerRoleIds.length) {
			return;
		}

		const guild = await client.guilds.fetch(configService.config.guildId);
		const roles = Array.from(guild.roles.cache.values());

		for (const role of roles) {
			if (role.id === guild.id) {
				continue; // Skip @everyone role
			}

			await this.fixRole(role);
		}
	}

	async fixRole(role) {
		const dividerRoleIds = configService.config.rolesDividers?.dividerRoleIds || [];
		if (!dividerRoleIds.length) {
			return;
		}

		if (dividerRoleIds.includes(role.id)) {
			await this.fixDividerRole(role);
		}
	}

	async fixDividerRole(role) {
		const updates = {};
		const resizedName = textResizingService.resizeText(
			role.name,
			textResizingService.maxSize,
			textResizingService.textAlign.center
		);

		if (role.name !== resizedName) {
			updates.name = resizedName;
		}

		if (role.color !== this.dividerDefaultColor) {
			updates.color = this.dividerDefaultColor;
		}

		if (!Object.keys(updates).length) {
			return;
		}

		try {
			await role.edit(updates);
		} catch (err) {
			logError(err, `Error editing divider role: ${role.id}; old name: "${role.name}"; new name: "${resizedName}"; `);
		}
	}

	async refreshRolesGroups(client) {
		const dividerRoles = configService.config.rolesDividers?.dividerRoleIds || [];
		if (!dividerRoles.length) {
			return;
		}

		const guild = await client.guilds.fetch(configService.config.guildId);

		// Get all roles from server and sort by position
		const allRoles = Array.from(guild.roles.cache.values())
			.sort((a, b) => b.position - a.position);

		const groups = [];
		let currentGroup = {
			dividerRoleId: "",
			roles: []
		};

		for (const role of allRoles) {
			// Skip @everyone role
			if (role.id === guild.id) continue;

			// If role is a divider
			if (dividerRoles.includes(role.id)) {
				// Save current group if it has roles
				if (currentGroup.roles.length > 0) {
					groups.push(currentGroup);
				}

				// Start new group with divider
				currentGroup = {
					dividerRoleId: role.id,
					roles: []
				};
			} else {
				// Add regular role to current group
				currentGroup.roles.push({
					id: role.id,
					name: role.name
				});
			}
		}

		// Add last group if it has roles
		if (currentGroup.roles.length > 0) {
			groups.push(currentGroup);
		}

		this.rolesGroups = groups;
	}

	refreshRolesGroupsDebounced(client) {
		// Clear existing timer
		if (this.refreshRolesGroupsTimer) {
			clearTimeout(this.refreshRolesGroupsTimer);
		}

		// Set new debounced timer
		this.refreshRolesGroupsTimer = setTimeout(async () => {
			try {
				await this.refreshRolesGroups(client);
				this.refreshRolesGroupsTimer = null;
			} catch (err) {
				logError(err, "Error refreshing roles groups");
			}
		}, this.DEBOUNCE_DELAY);
	}

	async fixMemberRolesDividersAll(client, guild) {
		const members = await guild.members.fetch();
		let processed = 0;
		let modified = 0;

		for (const [ , member ] of members) {
			const { hasChanges: memberModified } = await this.fixMemberRolesDividers(client, member);
			if (memberModified) {
				modified++;
			}
			processed++;
		}

		return { processed, modified };
	}

	fixMemberRolesDividersDebounced(client, member) {
		const memberId = member.id;

		// Clear existing timer for this member
		if (this.memberUpdateTimers.has(memberId)) {
			clearTimeout(this.memberUpdateTimers.get(memberId));
		}

		// Set new debounced timer
		const timer = setTimeout(async () => {
			try {
				await this.fixMemberRolesDividers(client, member);
				this.memberUpdateTimers.delete(memberId);
			} catch (err) {
				logError(err, `Error with memberId: ${memberId};`);
			}
		}, this.DEBOUNCE_DELAY);

		this.memberUpdateTimers.set(memberId, timer);
	}

	async fixMemberRolesDividers(client, member) {
		// Get current user roles
		const userRoleIds = new Set(member.roles.cache.map(role => role.id));

		const logMessages = [];
		let hasChanges = false;

		// Check each group for divider management
		for (let i = 0; i < this.rolesGroups.length; i++) {
			const group = this.rolesGroups[i];

			// Skip first group (it has no divider)
			if (!group.dividerRoleId) {
				continue;
			}

			// Check if user has any roles from this group
			const hasRoleFromGroup = group.roles.some(role => userRoleIds.has(role.id));
			const hasDivider = userRoleIds.has(group.dividerRoleId);

			// Check if this is the first group with user roles (no roles from higher groups)
			const isFirstGroup = !this.rolesGroups.slice(0, i).some(prevGroup =>
				prevGroup.roles.some(role => userRoleIds.has(role.id))
			);

			// If user has roles from group but no divider - add divider
			if (!isFirstGroup && hasRoleFromGroup && !hasDivider) {
				await member.roles.add(group.dividerRoleId);
				const message = `Добавлен разделитель <@&${group.dividerRoleId}> к <@${member.id}>`;
				logMessages.push(message);
				hasChanges = true;
			}

			// If user has no roles from group but has divider - remove divider
			if ((!hasRoleFromGroup || isFirstGroup) && hasDivider) {
				await member.roles.remove(group.dividerRoleId);
				const message = `Удалён разделитель <@&${group.dividerRoleId}> у <@${member.id}>`;
				logMessages.push(message);
				hasChanges = true;
			}
		}

		// Send combined log message to channel
		this.logFixChanges(client, logMessages);

		return { hasChanges };
	}

	logFixChanges(client, messages) {
		const logsChannelId = configService.config.rolesDividers?.logsChannelId;
		if (!messages.length || !logsChannelId) return;

		this.logFixChangesBuffer.push(...messages);

		if (this.logFixChangesBuffer.length >= 2) {
			this._flushLogFixChanges(client);
			return;
		}

		if (this.logFixChangesTimer) {
			clearTimeout(this.logFixChangesTimer);
		}

		this.logFixChangesTimer = setTimeout(() => {
			this._flushLogFixChanges(client);
		}, this.LOG_DEBOUNCE_DELAY);
	}

	async _flushLogFixChanges(client) {
		if (this.logFixChangesTimer) {
			clearTimeout(this.logFixChangesTimer);
			this.logFixChangesTimer = null;
		}

		const logsChannelId = configService.config.rolesDividers?.logsChannelId;
		const buffered = this.logFixChangesBuffer;
		this.logFixChangesBuffer = [];

		if (!buffered.length || !logsChannelId) return;

		try {
			const logChannel = await client.channels.fetch(logsChannelId);
			if (logChannel && logChannel.isTextBased()) {
				await sendLongMessage(logChannel, buffered.join("\n"));
			}
		} catch (err) {
			logError(err);
		}
	}
}

module.exports = new RoleDividerService();
