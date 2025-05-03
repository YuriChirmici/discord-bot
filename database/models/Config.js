const mongoose = require("mongoose");

const ConfigSchema = new mongoose.Schema(
	{
		config: Object,
		type: String,
		source: String,
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Config", ConfigSchema);
