const mongoose = require("mongoose");

const AdStatsSchema = new mongoose.Schema({
	memberId: { type: String, unique: true },
	roles: Object,
	dateUpdated: { type: Date, default: new Date() }
});

module.exports = mongoose.model("AdStats", AdStatsSchema);
