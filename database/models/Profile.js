const mongoose = require("mongoose");

const ProfileSchema = new mongoose.Schema({
	memberId: { type: String, unique: true },
	vacationStart: Date,
	vacationEnd: Date,
	sheetItem: {
		_id: false,
		serialNumber: Number,
		channelId: String,
		messageId: String,
	},
	gameAccounts: [ {
		_id: false,
		nickname: String,
		entryDate: String,
		lastSavedRating: Number,
		regimentId: Number,
	} ],
	lastSheetDiscordName: String,
	gameTrackingChannelId: String,
	dateCreated: { type: Date, default: new Date() }
})
	.index({ memberId: 1 })
	.index({ gameTrackingChannelId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Profile", ProfileSchema);
