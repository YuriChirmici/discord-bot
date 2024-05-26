const { ChannelType, EmbedBuilder } = require("discord.js");
const { authFlow: authFlowConfig, adsConfig } = require("../config.json");
const { Models } = require("../database");
const { createButtons, createSelect, getButtonsFlat } = require("../services/helpers");

class AuthFlowService {
	constructor() {
		this.NAME = "AuthFlow";
	}

	async startFlow(member, client) {
		const memberId = member.id;

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

		await channel.permissionOverwrites.create(member.user.id, {
			ViewChannel: true,
		});

		return channel;
	}

	async createDbRecord({ memberId, channelId }) {
		return await Models.AuthFlow.create({
			memberId,
			channelId,
			answers: [],
			questions: authFlowConfig.questions
		});
	}

	async sendQuestion({ dbRecord, client, question, channel, interaction }) {
		const newMessage = this._prepareMessage(question, { memberId: dbRecord.memberId });

		if (interaction) {
			await interaction.deferReply();
			await interaction.deleteReply();
		}

		await channel.send(newMessage);

		if (question.next && question.skipAnswer) {
			// for cases when we should send next question immediately after previous one
			const nextQuestion = this._getQuestionById(question.next);
			await this.sendQuestion({ dbRecord, client, question: nextQuestion, channel });
		} else {
			await Models.AuthFlow.updateOne({ memberId: dbRecord.memberId }, { currentQuestionId: question.id });
		}
	}

	_prepareMessage(question, { memberId }) {
		const components = [];
		if (question.select) {
			const customId = `${this.NAME}_${JSON.stringify({ questionId: question.id })}`;
			components.push(createSelect(customId, question.select));
		}

		if (question.buttons?.length) {
			components.push(...createButtons(question.buttons, { prefix: this.NAME }, { questionId: question.id }));
		}

		return {
			components,
			content: this._prepareMessageText(question.text, { memberId })
		};
	}

	_prepareMessageText(text = "", data = {}) {
		return text.replace("@User", `<@${data.memberId}>`).replace("{{user}}", data.name || "");
	}

	async buttonClick({ interaction, client }) {
		const { questionId } = interaction.customData;
		const buttonIndex = +interaction.customData.index;

		const question = this._getQuestionById(questionId);
		const btn = getButtonsFlat(question?.buttons)[buttonIndex];
		if (!question || !btn) {
			// unexpected
			return;
		}

		await this.onAnswer({
			client,
			interaction,
			channel: interaction.channel,
			member: interaction.member,
			message: interaction.message,
			question,
			nextQuestionId: btn.next,
			isSubmit: btn.isSubmit,
			answerData: { buttonIndex }
		});
	}

	async removeMessagesAfterDate(channel, date) {
		let messages = await channel.messages.fetch({ limit: 100 });
		messages = messages.filter((msg) => msg.createdTimestamp > date);

		await channel.bulkDelete(messages);
	}

	async submit({ dbRecord, member, channel, client }) {
		const promises = [
			this._changeResultRoles(dbRecord, member),
			channel.delete(),
			Models.AuthFlow.updateOne({ memberId: dbRecord.memberId }, { completed: true, currentQuestionId: null })
		];

		const nickname = this._buildNicknameFromAnswers(dbRecord, member.user.globalName);
		if (authFlowConfig.resultChannelId) {
			promises.push(this.sendResult(dbRecord, client, member, { nickname }));
		}

		if (nickname) {
			promises.push(member.setNickname(nickname));
		}

		await Promise.all(promises);
	}

	async _changeResultRoles(dbRecord, member) {
		const rolesAdd = [];
		const rolesRemove = [];

		dbRecord.answers.forEach(({ questionId, buttonIndex, selectValues }) => {
			const question = this._getQuestionById(questionId);
			if (buttonIndex || buttonIndex === 0) {
				const button = getButtonsFlat(question.buttons)[buttonIndex];
				rolesAdd.push(...(button.rolesAdd || []));
				rolesRemove.push(...(button.rolesRemove || []));
			} else if (selectValues?.length) {
				const options = selectValues.map((value) => question.select.options.find((o) => o.text === value));
				const optionsRolesAdd = options.map((o) => o.rolesAdd || []).flat();
				const optionsRolesRemove = options.map((o) => o.rolesRemove || []).flat();
				rolesAdd.push(...optionsRolesAdd);
				rolesRemove.push(...optionsRolesRemove);
			}
		});

		if (rolesAdd.length) {
			await member.roles.add(rolesAdd);
		}

		if (rolesRemove.length) {
			await member.roles.remove(rolesRemove);
		}
	}

	async sendResult(dbRecord, client, member, { nickname }) {
		const resultChannelId = authFlowConfig.resultChannelId;
		const channel = await client.channels.fetch(resultChannelId);

		const resultHeader = this._prepareMessageText(authFlowConfig.resultHeader, { name: nickname || member.user.globalName });
		let result = "";

		dbRecord.answers.forEach(({ questionId, buttonIndex, textAnswer, selectValues }) => {
			const question = this._getQuestionById(questionId);
			if (question.hideInResult) {
				return;
			}

			let questionDataText = `Q: ${question.resultText || question.text || ""}:\nA: `;
			if (buttonIndex || buttonIndex === 0) {
				const button = getButtonsFlat(question.buttons)[buttonIndex];
				questionDataText += `${button.emoji || ""} ${button.resultText || button.text || ""}`.trim();
			} else if (textAnswer?.text) {
				questionDataText += textAnswer.text;
			} else if (selectValues?.length) {
				const optionsTexts = [];
				question.select.options.forEach((option) => {
					const userValue = selectValues.find((value) => value === option.text);
					if (userValue) {
						optionsTexts.push(option.resultText || option.text || "");
					}
				});
				questionDataText += optionsTexts.join(", ");
			}

			result += this._prepareMessageText(questionDataText, { memberId: member.id }) + "\n\n";
		});

		const embed = new EmbedBuilder()
			.setColor(adsConfig.borderColor)
			.setTitle(resultHeader || "Title")
			.setDescription(result);

		await channel.send({ embeds: [ embed ] });
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
		if (!currentQuestionId) {
			// message in other channels
			return;
		}

		const question = this._getQuestionById(currentQuestionId);
		if (question.withTextAnswer && !question.textAnswerKey) {
			question.textAnswerKey = "id_" + Date.now();
		}

		if (!question.textAnswerKey) {
			// text answer is not expected for this question
			return;
		}

		await this.onAnswer({
			client,
			channel,
			member: message.member,
			message,
			question,
			nextQuestionId: question.next,
			isSubmit: question.isSubmit,
			answerData: {
				textAnswer: {
					key: question.textAnswerKey,
					text: messageText,
				}
			}
		});
	}

	_buildNicknameFromAnswers(dbRecord, globalName) {
		const textAnswers = {};
		dbRecord.answers.forEach(({ textAnswer }) => {
			textAnswers[textAnswer.key] = textAnswer.text;
		});

		let { nickname, name, regiment } = textAnswers;

		nickname ||= globalName || "";
		let result = `${regiment || ""} ${nickname}`.trim();
		if (name) {
			result += ` (${name})`;
		}

		return result.substring(0, 32);
	}

	async stringSelect({ interaction, client }) {
		const { questionId } = interaction.customData;
		const question = this._getQuestionById(questionId);

		const selectValues = interaction.values || [];
		const option = question.select.options.find((o) => o.text === selectValues[0]);

		await this.onAnswer({
			client,
			interaction,
			channel: interaction.channel,
			member: interaction.member,
			message: interaction.message,
			question,
			nextQuestionId: option?.next || question.next,
			isSubmit: question.isSubmit,
			answerData: { selectValues }
		});
	}

	async onAnswer({ client, interaction, channel, member, message, question, nextQuestionId, isSubmit, answerData = {} }) {
		const questionId = question.id;
		const memberId = member.id;

		let dbRecord = await Models.AuthFlow.findOne({ memberId }).lean();
		if (questionId !== dbRecord.currentQuestionId) {
			const messageDate = message.createdTimestamp;
			await this.processAnswerOnPrevQuestion({ messageDate, dbRecord, channel, questionId });
		}

		dbRecord.answers.push({ questionId, ...answerData });
		dbRecord = await Models.AuthFlow.findOneAndUpdate({ memberId }, { answers: dbRecord.answers }, { new: true });

		if (nextQuestionId) {
			const nextQuestion = this._getQuestionById(nextQuestionId);
			await this.sendQuestion({ dbRecord, client, question: nextQuestion, channel, interaction });
		} else if (isSubmit) {
			await this.submit({ dbRecord, member, channel, client });
		}
	}

	async processAnswerOnPrevQuestion({ messageDate, dbRecord, channel, questionId }) {
		const answerIndex = dbRecord.answers.findIndex((a) => a.questionId === questionId);
		if (answerIndex !== -1) {
			dbRecord.answers = dbRecord.answers.slice(0, answerIndex);
			await this.removeMessagesAfterDate(channel, messageDate);
		}
	}
}

module.exports = new AuthFlowService();
