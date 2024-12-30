const mongoose = require("mongoose");

const SchedulerSchema = new mongoose.Schema({
	name: String,
	executionDate: Date,
	period: Number,
	data: Object
}).index({ executionDate: 1 });

module.exports = mongoose.model("Scheduler", SchedulerSchema);
