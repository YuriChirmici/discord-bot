const { AttachmentBuilder } = require("discord.js");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const configService = require("./config");
const { Models } = require("../database");
const { clearDirectory, getFolderSize } = require("./helpers");

class MessagesDeletionService {
	constructor() {
		this.filesFolder = path.join(__dirname, "../src/messages-files");
		if (!fs.existsSync(this.filesFolder)) {
			fs.mkdirSync(this.filesFolder);
		}
	}

	async checkShouldLog({ client, memberId, channelId }) {
		const guild = await client.guilds.fetch(configService.guildId);
		if (!(await this.checkShouldLogChannel({ guild, channelId }))) {
			return false;
		}

		const { rolesExceptions = [] } = configService.deletedMessagesLogging;
		if (rolesExceptions.length) {
			const member = await guild.members.fetch(memberId);
			const hasExceptionRoles = !!member.roles.cache.find(r => rolesExceptions.includes(r.id));
			if (hasExceptionRoles) {
				return false;
			}
		}

		return true;
	};

	async checkShouldLogChannel({ guild, channelId }) {
		const { channelExceptions = [] } = configService.deletedMessagesLogging;
		if (channelExceptions.includes(channelId)) {
			return false;
		}

		const channel = await guild.channels.fetch(channelId);
		if (channel.parentId) {
			return await this.checkShouldLogChannel({ guild, channelId: channel.parentId });
		}

		return true;
	};

	async getDeletedFilesData(messageId, oldAttachments, newAttachments = new Set()) {
		const oldFiles = Array.from(oldAttachments.values());
		const newFiles = Array.from(newAttachments.values());
		const deletedFilesCount = oldFiles.length - newFiles.length;
		if (!deletedFilesCount) {
			return {};
		}

		const deletedFilesIds = oldFiles
			.filter((oldFile) => !newFiles.find((newFile) => newFile.id === oldFile.id))
			.map(({ id }) => id);

		const files = await this.getMessageFiles(messageId, deletedFilesIds);
		let attachments = files.map((file) => new AttachmentBuilder(file.fileBuffer, { name: file.fileName }));
		await this.deleteMessageFilesByIds(messageId, deletedFilesIds);

		let attachmentsText = "Файл(ы) удален(ы):";
		const diff = deletedFilesCount - attachments.length;
		if (diff) {
			attachmentsText += `\n(Не удалось получить файлы: ${diff} из ${deletedFilesCount})`;
		}

		return { attachmentsText, attachments };
	};

	async logMessageAttachments(message) {
		const messageId = message.id;
		const memberId = message.author.id;
		const channelId = message.channelId;

		const filesArr = Array.from(message.attachments.values())
			.filter((file) => file.size <= configService.deletedMessagesLogging.savedFileMaxSizeMB * (1024 ** 2));

		const filesSize = filesArr.reduce((sum, data) => sum + data.size, 0);
		const dirSize = await this.getFilesDirSize();
		const maxSize = configService.deletedMessagesLogging.savedFolderMaxSizeMB * (1024 ** 2);

		await this.freeUpSpace(filesSize + dirSize - maxSize);

		const filesData = await this.fetchAttachments(filesArr);
		await this.saveMessageFiles({ memberId, messageId, channelId, filesData });
	}

	async getFilesDirSize() {
		return await getFolderSize(this.filesFolder);
	}

	async fetchAttachments(filesArr) {
		const files = await Promise.all(filesArr.map(async file => {
			const fileBuffer = await this.fetchAttachment(file.url);
			const fileParts = file.name.split(".");
			const fileExt = fileParts[fileParts.length - 1];

			return {
				fileBuffer,
				discordId: file.id,
				fileName: file.name,
				filePath: path.join(this.filesFolder, `${uuidv4()}.${fileExt}`),
			};
		}));

		return files;
	}

	async fetchAttachment(url) {
		const response = await fetch(url);
		if (!response.ok) {
			return;
		}

		const buffer = await response.buffer();
		return buffer;
	};

	async saveMessageFiles({ memberId, messageId, channelId, filesData }) {
		await Promise.all(filesData.map(({ filePath, fileBuffer }) =>
			fs.promises.writeFile(filePath, fileBuffer, "binary")
		));

		filesData.forEach((file) => file.size = fs.statSync(file.filePath).size);

		const filesSize = filesData.reduce((sum, data) => sum + data.size, 0);
		await Models.MessageFiles.create({
			memberId,
			messageId,
			channelId,
			files: filesData,
			filesSize,
		});
	}

	async getMessageFiles(messageId, fileIds) {
		const document = await Models.MessageFiles.findOne({ messageId }).lean();
		if (!document) {
			return [];
		}

		const files = document.files.filter((file) => fileIds.includes(file.discordId));
		const filesData = await this.getFiles(files);

		return filesData;
	}

	async getFiles(files) {
		const filesData = await Promise.all(files.map(async (file) => {
			const fileBuffer = await fs.promises.readFile(file.filePath);
			return {
				...file,
				fileBuffer
			};
		}));

		return filesData;
	}

	// #region deletion
	async deleteFilesByChannelId(channelId) {
		const documents = await Models.MessageFiles.find({ channelId });
		await Promise.all(documents.map((doc) => this.clearDocument(doc)));
	}

	async clearDocument(document) {
		await this.deleteFiles(document.files);
		await Models.MessageFiles.deleteOne({ _id: document._id });
	}

	async deleteMessageFilesByIds(messageId, fileIds = []) {
		const document = await Models.MessageFiles.findOne({ messageId });
		if (!document) {
			return;
		}

		const filesForDeletion = document.files.filter((file) => fileIds.includes(file.discordId));

		if (filesForDeletion.length === document.files.length) {
			await this.clearDocument(document);
		} else {
			await this.deleteFiles(filesForDeletion);
			await Models.MessageFiles.updateOne({ messageId }, { $pull: { files: { discordId: { $in: fileIds } } } });
		}
	}

	async deleteFiles(files) {
		await Promise.all(files.map((file) => fs.promises.unlink(file.filePath)));
	}

	async clearAll() {
		await Promise.all([
			clearDirectory(this.filesFolder),
			await Models.MessageFiles.deleteMany({}),
		]);
	}

	async freeUpSpace(size) {
		if (size <= 0) {
			return;
		}

		const documents = await this.getOldDocuments();
		for (let doc of documents) {
			await this.clearDocument(doc);
			size -= doc.filesSize;

			if (size <= 0) {
				break;
			}
		}

		await this.freeUpSpace(size);
	}

	async getOldDocuments(limit = 50) {
		const documents = await Models.MessageFiles.find({}).sort({ createdAt: 1 }).limit(limit);
		return documents;
	}
	// #endregion
}

module.exports = new MessagesDeletionService();
