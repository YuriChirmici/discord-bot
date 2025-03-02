const mongoose = require("mongoose");

const MessageFilesSchema = new mongoose.Schema({
	messageId: { type: String, unique: true },
	channelId: String,
	memberId: String,
	files: [ {
		filePath: String,
		fileName: String,
		discordId: String,
		_id: false,
	} ],
	filesSize: Number,
}, { timestamps: true });

module.exports = mongoose.model("MessageFiles", MessageFilesSchema);
