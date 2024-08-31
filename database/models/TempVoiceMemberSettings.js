const mongoose = require("mongoose");

const TempVoiceMemberSettingsSchema = new mongoose.Schema({
	categoryId:	String,
	memberId:	String,
	name: 		String,
	userLimit: 	Number,
	rtcRegion: 	String,
	permissions: [ {
		id: 	String,
		allow: 	[ String ],
		deny: 	[ String ],
	} ],
}).index({ categoryId: 1, memberId: 1 }, { unique: true });

module.exports = mongoose.model("TempVoiceMemberSettings", TempVoiceMemberSettingsSchema);
