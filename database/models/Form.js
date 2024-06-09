const mongoose = require("mongoose");

const AnswerSchema = new mongoose.Schema({
	questionId: String,
	buttonIndex: Number,
	textAnswers: [ {
		key: String,
		text: String,
	} ],
	selectValues: [ String ]
}, { _id: false });

const FormSchema = new mongoose.Schema({
	memberId: String,
	channelId: { type: String, unique: true },
	formName: String,
	answers: [ AnswerSchema ],
	completed: Boolean,
	currentQuestionId: String,
	dateUpdated: { type: Date, default: new Date() }
}).index({ memberId: 1 });

module.exports = mongoose.model("Form", FormSchema);
