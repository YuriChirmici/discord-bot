const mongoose = require("mongoose");

const TempVoiceChannelSchema = new mongoose.Schema({
	channelId:			{ type: String, unique: true },
	creatingChannelId:	String,
	ownerId:			String,
}).index({ channelId: 1 });

module.exports = mongoose.model("TempVoiceChannel", TempVoiceChannelSchema);
