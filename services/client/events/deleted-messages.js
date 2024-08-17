const { Events, AttachmentBuilder, AuditLogEvent } = require("discord.js");
const configService = require("../../config");
const fetch = require("node-fetch");

const checkShouldNotify = async ({ client, memberId, channelId }) => {
	const { channelExceptions = [], rolesExceptions = [] } = configService.deletedMessagesLogging;
	channelExceptions.push(configService.deletedMessagesLogging.channelId);

	if (channelExceptions.includes(channelId)) {
		return false;
	}

	if (rolesExceptions.length) {
		const guild = await client.guilds.fetch(configService.guildId);
		const member = await guild.members.fetch(memberId);
		const hasExceptionRoles = !!member.roles.cache.find(r => rolesExceptions.includes(r.id));
		if (hasExceptionRoles) {
			return false;
		}
	}

	return true;
};

const createDeletedAttachments = async (deletedFiles) =>
	await Promise.all(deletedFiles.map((file) => copyDocument(file)));

const copyDocument = async (attachment) => {
	const response = await fetch(attachment.url);
	const buffer = await response.buffer();
	const newAttachment = new AttachmentBuilder(buffer, { name: attachment.name });
	return newAttachment;
};

const notifyEdited = async (client, oldState, newState) => {
	const messageUrl = `https://discord.com/channels/${configService.guildId}/${oldState.channelId}/${newState.id}`;
	let message = `Редактирование (<@${newState.author.id}> в ${messageUrl})\n`;

	let hasTextLogs = false;
	if ((oldState.content || "").trim() && oldState.content !== newState.content) {
		// text editing
		hasTextLogs = true;
		message += `${oldState.content}\n↓\n${newState.content}`;
	}

	let attachments;
	const oldFiles = Array.from(oldState.attachments.values());
	const newFiles = Array.from(newState.attachments.values());
	if (oldFiles.length !== newFiles.length) {
		// file deletion
		message += "Файл(ы) удален(ы):";
		const deletedFiles = oldFiles.filter((oldFile) => !newFiles.find((newFile) => newFile.id === oldFile.id));
		attachments = await createDeletedAttachments(deletedFiles);
	}

	if (!hasTextLogs && !attachments?.length) {
		return;
	}

	await sendLog(client, message, attachments);
};

const notifyDeleted = async (client, oldState) => {
	const auditLog = await getAuditLog(oldState.guild, oldState.author.id);

	const dateCreated = new Date(oldState.createdTimestamp).toLocaleString("ru-RU", { timeZoneName: "short" });
	let message = `Удаление (<#${oldState.channelId}>)\n` +
		(auditLog ? `Удалил: <@${auditLog.executor.id}>\n` : "") +
		`Автор сообщения: <@${oldState.author.id}>\n` +
		`Дата создания сообщения: ${dateCreated}\n`;

	if (oldState.content) {
		message += `Сообщение: ${oldState.content}`;
	}

	let attachments;
	const files = Array.from(oldState.attachments.values());
	if (files.length) {
		// file deletion
		message += "\n\nФайл(ы) удален(ы):";
		attachments = await createDeletedAttachments(files);
	}

	await sendLog(client, message, attachments);
};

const getAuditLog = async (guild, targetId) => {
	const fetchedLogs = await guild.fetchAuditLogs({
		limit: 5,
		type: AuditLogEvent.MessageDelete,
	});

	const logs = Array.from(fetchedLogs.entries.values());
	const logsStartDate = Date.now() - 8000;
	const auditLog = logs.find((log) => log.targetId === targetId && log.createdTimestamp > logsStartDate);

	return auditLog;
};

const sendLog = async (client, content, files) => {
	const logsChannel = await client.channels.fetch(configService.deletedMessagesLogging.channelId);
	await logsChannel.send({ content, files });
};

const registerEvents = (client) => {
	client.on(Events.MessageUpdate, async (oldState, newState) => {
		try {
			const memberId = newState.author.id;
			const channelId = newState.channelId;
			const shouldNotify = await checkShouldNotify({ client, memberId, channelId });
			if (!shouldNotify) {
				return;
			}

			await notifyEdited(client, oldState, newState);
		} catch (err) {
			logError(err);
		}
	});

	client.on(Events.MessageDelete, async (oldState) => {
		try {
			// wait in case the audit log has not been created yet
			await new Promise((resolve) => setTimeout(resolve, 2000));
			const memberId = oldState.author.id;
			const channelId = oldState.channelId;
			const shouldNotify = await checkShouldNotify({ client, memberId, channelId });
			if (!shouldNotify) {
				return;
			}

			await notifyDeleted(client, oldState);
		} catch (err) {
			logError(err);
		}
	});
};

module.exports = {
	registerEvents
};
