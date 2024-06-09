const mongoose = require("mongoose");

const ProfileSchema = new mongoose.Schema({
	memberId: { type: String, unique: true },
	vacationStart: Date,
	vacationEnd: Date,
	dateCreated: { type: Date, default: new Date() }
}).index({ memberId: 1 });

module.exports = mongoose.model("Profile", ProfileSchema);
