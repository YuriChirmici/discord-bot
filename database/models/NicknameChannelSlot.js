const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
	serialNumber: {
		type: Number,
		unique: true,
		required: true
	},
	memberId: {
		type: String,
		unique: true,
		sparse: true
	},
	channelId: {
		type: String,
		required: true
	},
	messageId: {
		type: String,
		required: true
	},
}).index({ serialNumber: 1 });

module.exports = mongoose.model("NicknameChannelSlot", Schema);
