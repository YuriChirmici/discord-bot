const mongoose = require("mongoose");

const CustomIdSchema = new mongoose.Schema({
	commandName: String,
	data: Object,
	channelId: String,
	date: { type: Date, default: new Date() }
});

module.exports = mongoose.model("CustomId", CustomIdSchema);
