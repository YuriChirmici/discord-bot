const mongoose = require("mongoose");

const AnswerSchema = new mongoose.Schema({
	questionId: String,
	buttonIndex: Number,
	textAnswer: {
		key: String,
		text: String,
	}
}, { _id: false });

const AuthFlowSchema = new mongoose.Schema({
	memberId: { type: String, unique: true },
	channelId: { type: String, unique: true },
	answers: [ AnswerSchema ],
	completed: Boolean,
	currentQuestionId: String,
	dateUpdated: { type: Date, default: new Date() }
}).index({ memberId: 1 });

module.exports = mongoose.model("AuthFlow", AuthFlowSchema);
