const { Events, AuditLogEvent } = require("discord.js");
const configService = require("../../config");
const messageDeletionService = require("../../messages-deletion");

const notifyEdited = async ({ client, oldState, newState }) => {
	const messageUrl = `https://discord.com/channels/${configService.guildId}/${oldState.channelId}/${newState.id}`;
	let message = `Редактирование (<@${newState.author.id}> в ${messageUrl})\n`;

	let hasTextLogs = false;
	if ((oldState.content || "").trim() && oldState.content !== newState.content) {
		// text editing
		hasTextLogs = true;
		message += `${oldState.content}\n↓\n${newState.content}\n`;
	}

	const { attachmentsText = "", attachments } = await messageDeletionService.getDeletedFilesData(
		oldState.id,
		oldState.attachments,
		newState.attachments
	);

	message += attachmentsText;

	if (!hasTextLogs && !attachmentsText) {
		return;
	}

	await sendLog({ client, message, attachments });
};

const notifyDeleted = async ({ client, oldState }) => {
	const auditLog = await getAuditLog(oldState.guild, oldState.author.id, true);

	const dateCreated = new Date(oldState.createdTimestamp).toLocaleString("ru-RU", { timeZoneName: "short" });
	let message = `Удаление (<#${oldState.channelId}>)\n` +
		(auditLog ? `Удалил: <@${auditLog.executor.id}>\n` : "") +
		`Автор сообщения: <@${oldState.author.id}>\n` +
		`Дата создания сообщения: ${dateCreated}\n`;

	if (oldState.content) {
		message += `Сообщение: ${oldState.content}\n`;
	}

	let stickers = Array.from(oldState.stickers.values()).map (({ id }) => id);

	const { attachmentsText = "", attachments } = await messageDeletionService.getDeletedFilesData(
		oldState.id,
		oldState.attachments
	);

	message += attachmentsText;

	await sendLog({ client, message, attachments, stickers });
};

const getAuditLog = async (guild, targetId, shouldWait) => {
	if (shouldWait) {
		// wait in case the audit log has not been created yet
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}

	const fetchedLogs = await guild.fetchAuditLogs({
		limit: 5,
		type: AuditLogEvent.MessageDelete,
	});

	const logs = Array.from(fetchedLogs.entries.values());
	const logsStartDate = Date.now() - 8000;
	const auditLog = logs.find((log) => log.targetId === targetId && log.createdTimestamp > logsStartDate);

	return auditLog;
};

const sendLog = async ({ client, message, attachments, stickers }) => {
	const logsChannel = await client.channels.fetch(configService.deletedMessagesLogging.channelId);
	await logsChannel.send({
		content: message.trim(),
		files: attachments,
		stickers
	});
};

const registerEvents = (client) => {
	client.on(Events.MessageUpdate, async (oldState, newState) => {
		try {
			const memberId = newState.author.id;
			const channelId = newState.channelId;

			const shouldNotify = await messageDeletionService.checkShouldLog({ client, memberId, channelId });
			if (!shouldNotify) {
				return;
			}

			await notifyEdited({ client, oldState, newState });
		} catch (err) {
			logError(err);
		}
	});

	client.on(Events.MessageDelete, async (oldState) => {
		try {
			const memberId = oldState.author.id;
			const channelId = oldState.channelId;

			const shouldNotify = await messageDeletionService.checkShouldLog({ client, memberId, channelId });
			if (!shouldNotify) {
				return;
			}

			await notifyDeleted({ client, oldState });
		} catch (err) {
			logError(err);
		}
	});

	client.on(Events.MessageCreate, async (message) => {
		try {
			const memberId = message.author.id;
			const channelId = message.channelId;
			const shouldNotify = await messageDeletionService.checkShouldLog({ client, memberId, channelId });
			if (!shouldNotify || !message.attachments.size) {
				return;
			}

			await messageDeletionService.logMessageAttachments(message);
		} catch (err) {
			logError(err);
		}
	});

	client.on(Events.ChannelDelete, async (channel) => {
		try {
			await messageDeletionService.deleteFilesByChannelId(channel.id);
		} catch (err) {
			logError(err);
		}
	});
};

module.exports = {
	registerEvents
};
