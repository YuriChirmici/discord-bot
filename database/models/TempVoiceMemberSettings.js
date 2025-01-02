const mongoose = require("mongoose");

const TempVoiceMemberSettingsSchema = new mongoose.Schema({
	creatingChannelId: String,
	memberId:	String,
	name: 		String,
	userLimit: 	Number,
	rtcRegion: 	String,
	permissions: [ {
		_id:	false,
		itemId: String,
		type:   { type: Number },
		allow: 	[ String ],
		deny: 	[ String ],
	} ],
}).index({ creatingChannelId: 1, memberId: 1 }, { unique: true });

module.exports = mongoose.model("TempVoiceMemberSettings", TempVoiceMemberSettingsSchema);
