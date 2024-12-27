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
		gameNicknames: [ String ],
	},
	dateCreated: { type: Date, default: new Date() }
}).index({ memberId: 1 });

module.exports = mongoose.model("Profile", ProfileSchema);
