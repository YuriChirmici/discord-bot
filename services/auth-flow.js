const {
	ChannelType,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder
} = require("discord.js");
const { authFlow: authFlowConfig, ad: adConfig } = require("../config.json");
const { Models } = require("../database");

class AuthFlowService {
	NAME = "AuthFlow";

	async startFlow(member, client) {
		const memberId =  member.id;

		await this.clearOldMemberData(client, memberId);
	
		const promises = [ this.createChannel(member) ];
		if (authFlowConfig.initialRoles) {
			promises.push(member.roles.add(authFlowConfig.initialRoles));
		}

		const [ channel ] = await Promise.all(promises);
		const dbRecord = await this.createDbRecord({ memberId, channelId: channel.id });
		await this.sendQuestion({ dbRecord, client, question: this._getStartQuestion(), channel });
	}

	async clearOldMemberData(client, memberId) {
		try {
			const dbRecord = await Models.AuthFlow.findOneAndDelete({ memberId });
			if (dbRecord?.channelId) {
				const channel = await client.channels.fetch(dbRecord?.channelId);
				if (channel) {
					await channel.delete();
				}
			}
		} catch (err) {
			if (err.message !== "Unknown Channel") {
				logError(err);
			}
		}
	}

	async createChannel(member) {
		const channel = await member.guild.channels.create({
			type: ChannelType.GuildText,
			name: authFlowConfig.channelName.replace("{{user}}", member.user.globalName),
			parent: authFlowConfig.categoryId,
		});

		return channel;
	}

	async createDbRecord({ memberId, channelId }) {
		return await Models.AuthFlow.create({
			memberId,
			channelId,
			answers: [],
		})
	}

	async sendQuestion({ dbRecord, client, question, channel, interaction }) {
		const message = this._prepareMessage(question, { memberId: dbRecord.memberId });

		if (interaction) {
			await interaction.deferReply();
			await interaction.deleteReply();
		}

		await channel.send(message);

		if (question.next && !question.textAnswerKey) {
			const nextQuestion = this._getQuestionById(question.next);
			await this.sendQuestion({ dbRecord, client, question: nextQuestion, channel });
		} else {
			await Models.AuthFlow.updateOne({ memberId: dbRecord.memberId }, { currentQuestionId: question.id });
		}
	}

	_prepareMessage(question, { memberId }) {
		const buttons = (question.buttons || []).map((data, index) =>
			this._createButton({ ...data, index, questionId: question.id })
		)
		let components;
		if (buttons.length) {
			components = [ new ActionRowBuilder().addComponents(...buttons) ];
		}

		return {
			components,
			content: (question.text || "").replace("@User", `<@${memberId}>`),
		}
	}

	_createButton({ text, emoji, style, url, index, questionId, disabled }) {
		let button = new ButtonBuilder()
			.setStyle(style || ButtonStyle.Secondary);

		if (emoji) {
			button = button.setEmoji(emoji);
		}

		if (text) {
			button = button.setLabel(text);
		}

		if (url) {
			button = button.setURL(url);
		} else {
			const customId = `${this.NAME}_button_${questionId}_${index}`;
			button = button.setCustomId(customId);
		}

		if (disabled) {
			button = button.setDisabled(true);
		}
			
		return button;
	};

	async buttonClick({ interaction, client }) {
		const channel = interaction.channel;
		const memberId = interaction.member.id;
		const customId = interaction.customId;
		const parts = customId.split("_");
		const questionId = parts[2];
		const buttonIndex = +parts[3];

		const question = this._getQuestionById(questionId);
		const btn = question?.buttons?.[buttonIndex];
		if (!question || !btn) {
			return; // unexpected
		}

		let dbRecord = await Models.AuthFlow.findOne({ memberId }).lean();
		let answers = dbRecord.answers;

		if (questionId !== dbRecord.currentQuestionId) { // clicked button in prev questions
			const answerIndex = dbRecord.answers.findIndex((a) => a.questionId === questionId);
			if (answerIndex >= 0) {
				answers = dbRecord.answers.slice(0, answerIndex);
				await this.removeMessagesAfterDate(channel, interaction.message.createdTimestamp)
			}
		}

		answers.push({ questionId: question.id, buttonIndex });

		dbRecord = await Models.AuthFlow.findOneAndUpdate({ memberId }, { answers }, { new: true });
	
		if (btn.next) {
			const nextQuestion = this._getQuestionById(btn.next);
			await this.sendQuestion({ dbRecord, client, question: nextQuestion, interaction, channel });
		} else if (btn.isSubmit) {
			await this.submit({ dbRecord, member: interaction.member, channel, client });
		}
	}

	async removeMessagesAfterDate(channel, date) {
		let messages = await channel.messages.fetch({ limit: 100 });
		messages = messages.filter((msg) => msg.createdTimestamp > date);

		await channel.bulkDelete(messages);
	}

	async submit({ dbRecord, member, channel, client }) {
		const allRoles = [];
		const textAnswers = {};

		dbRecord.answers.forEach(({ questionId, buttonIndex, textAnswer }) => {
			textAnswers[textAnswer.key] = textAnswer.text;
			const question = this._getQuestionById(questionId);
			if (buttonIndex || buttonIndex === 0) {
				const button = question.buttons[buttonIndex];
				allRoles.push(...(button.roles || []));
			}
		})

		const promises = [
			channel.delete(),
			member.roles.add(allRoles),
			Models.AuthFlow.updateOne({ memberId: dbRecord.memberId }, { completed: true, currentQuestionId: null })
		];

		const nickname = (textAnswers.nickname || "").trim().substring(0, 31);
		if (authFlowConfig.resultChannelId) {
			promises.push(this.sendResult(dbRecord, client, member, { nickname }));
		}

		if (nickname) {
			promises.push(member.setNickname(nickname))
		}
		
		await Promise.all(promises);
	}

	_getStartQuestion() {
		return authFlowConfig.questions.find(({ isStart }) => isStart);
	}

	_getQuestionById(questionId) {
		return authFlowConfig.questions.find(({ id }) => id === questionId);
	}

	async textInput(message, client) {
		const messageText = message.content.trim();
		const channel = message.channel;
		const memberId = message.member.id;
		
		let dbRecord = await Models.AuthFlow.findOne({ memberId, channelId: channel.id }).lean();
		const currentQuestionId = dbRecord?.currentQuestionId;
		if (!currentQuestionId) { // message in other channels
			return;
		}

		const question = this._getQuestionById(currentQuestionId);
		if (!question.textAnswerKey) {
			return;
		}

		dbRecord = await Models.AuthFlow.findOneAndUpdate({ memberId }, { $push: { answers: {
			questionId: question.id,
			textAnswer: {
				key: question.textAnswerKey,
				text: messageText,
			}
		} }}, { new: true });

		if (question.next) {
			const nextQuestion = this._getQuestionById(question.next);
			await this.sendQuestion({ dbRecord, client, question: nextQuestion, channel });
		} else if (question.isSubmit) {
			await this.submit({ dbRecord, member: message.member, channel: message.channel, client} );
		}
	}

	async sendResult(dbRecord, client, member, { nickname }) {
		const resultChannelId = authFlowConfig.resultChannelId;
		const channel = await client.channels.fetch(resultChannelId);

		const resultHeader = (authFlowConfig.resultHeader || "").replace("{{user}}", nickname || member.user.globalName);
		let result = "";

		dbRecord.answers.forEach(({ questionId, buttonIndex, textAnswer }) => {
			const question = this._getQuestionById(questionId);
			result += `Q: ${question.resultText || question.text || ""}:\nA: `
			if (buttonIndex || buttonIndex === 0) {
				const button = question.buttons[buttonIndex];
				result += `${button.emoji || ""} ${button.answerText || button.text || ""}`.trim();
			} else if (textAnswer?.text) {
				result += textAnswer.text;
			}
			
			result += "\n\n";
		});

		const embed = new EmbedBuilder()
			.setColor(adConfig.color)
			.setTitle(resultHeader || "Title")
			.setDescription(result)

		await channel.send({ embeds: [ embed ] });
	}
}

module.exports = new AuthFlowService();