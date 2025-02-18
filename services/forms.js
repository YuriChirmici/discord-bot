const { ChannelType, ThreadAutoArchiveDuration } = require("discord.js");
const configService = require("./config");
const { Models } = require("../database");
const customIdService = require("./custom-id");
const {
	createButtons,
	createSelect,
	createModal,
	getButtonsFlat,
	removeMessagesAfterDate,
	generateRandomKey,
	getModalAnswers,
	createEmbed,
	getGuildMembers
} = require("./helpers");
const localizationService = require("./localization");

const local = localizationService.getLocal();

class FormsService {
	constructor() {
		this.NAME = "forms";
		this.formsNames = {
			auth: "auth"
		};
	}

	getFormByName(name) {
		const command = configService.memberCommands.find((c) => c.name === name);
		return command.type === "form" ? command : null;
	}

	async startForm({ interaction, member, client, formName }) {
		const memberId = member.id;
		const form = this.getFormByName(formName);

		const promises = [ this.createChannel(member, form, client) ];
		if (form.initialRoles?.length) {
			promises.push(member.roles.add(form.initialRoles));
		}

		const [ channel ] = await Promise.all(promises);
		const dbRecord = await this.createDbRecord({ memberId, channelId: channel.id, formName });
		await this.sendQuestion({ interaction, dbRecord, question: this._getStartQuestion(form), channel, formName, preventDefer: true });

		return { channel };
	}

	async clearOldMemberData({ client, memberId, formName }) {
		try {
			const dbRecord = await Models.Form.findOneAndDelete({ memberId, formName });
			if (dbRecord?.channelId) {
				await customIdService.clearCustomId({ channelId: dbRecord.channelId });
				const channel = await client.channels.fetch(dbRecord.channelId);
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

	async createChannel(member, form) {
		const channel = await member.guild.channels.fetch(form.parentChannelId);
		const thread = await channel.threads.create({
			name: form.channelName.replace("{{userName}}", member.user.globalName || member.user.username),
			autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
			type: ChannelType.PrivateThread,
		});

		await thread.members.add(member.id);

		return thread;
	}

	async createDbRecord(data) {
		return await Models.Form.create({ ...data, answers: [] });
	}

	_getStartQuestion(form) {
		return form.questions.find(({ isStart }) => isStart);
	}

	async sendQuestion(props) {
		const { interaction, dbRecord, question, channel, formName, preventDefer } = props;
		const customIdData = { commandName: this.NAME, channelId: channel.id, data: { questionId: question.id, formName } };

		if (question.modal) {
			if (!interaction || !interaction.showModal) {
				return;
			}

			const customId = await customIdService.createCustomId(customIdData);
			const modal = createModal(customId, question.modal);
			await interaction.showModal(modal);
			return;
		}

		if (interaction && !preventDefer) {
			try {
				await interaction.deferReply();
				await interaction.deleteReply();
			} catch (err) {
				console.log(err);
			}
		}

		const messageOptions = { memberId: dbRecord.memberId };
		const newMessage = await this._prepareMessage(question, messageOptions, customIdData);

		await channel.send(newMessage);

		if (question.next && question.skipAnswer) {
			// for cases when we should send next question immediately after previous one
			const nextQuestion = this._getQuestionById(question.next, formName);
			await this.sendQuestion({ ...props, question: nextQuestion });
		} else {
			await Models.Form.updateOne(
				{ _id: dbRecord._id },
				{ currentQuestionId: question.id, dateUpdated: new Date() }
			);
		}
	}

	async _prepareMessage(question, { memberId }, customIdData) {
		const components = [];
		if (question.select) {
			const customId = await customIdService.createCustomId(customIdData);
			components.push(createSelect(customId, question.select));
		}

		if (question.buttons?.length) {
			const buttons = await createButtons(question.buttons, customIdData);
			components.push(...buttons);
		}

		return {
			components,
			content: this._prepareMessageText(question.text, { memberId })
		};
	}

	_prepareMessageText(text = "", data = {}) {
		return text.replace("{{userTag}}", `<@${data.memberId}>`).replace("{{userName}}", data.name || "");
	}

	_getQuestionById(questionId, formName) {
		const form = this.getFormByName(formName);
		return form.questions.find(({ id }) => id === questionId);
	}

	async buttonClick({ interaction, client }) {
		const { questionId, formName } = interaction.customData;
		const buttonIndex = +interaction.customData.index;

		const question = this._getQuestionById(questionId, formName);
		const btn = getButtonsFlat(question?.buttons)[buttonIndex];
		if (!question || !btn) {
			// unexpected
			return;
		}

		await this.onAnswer({
			client,
			interaction,
			formName,
			channel: interaction.channel,
			member: interaction.member,
			message: interaction.message,
			question,
			nextQuestionId: btn.next || question.next,
			isSubmit: btn.isSubmit,
			answerData: { buttonIndex }
		});
	}

	async textInput(message, client) {
		const messageText = message.content.trim();
		const channel = message.channel;
		const memberId = message.member.id;

		let dbRecord = await Models.Form.findOne({ memberId, channelId: channel.id, completed: { $ne: true } }).lean();
		const currentQuestionId = dbRecord?.currentQuestionId;
		if (!currentQuestionId) {
			return;
		}

		const question = this._getQuestionById(currentQuestionId, dbRecord.formName);
		if (question.withTextAnswer && !question.textAnswerKey) {
			question.textAnswerKey = generateRandomKey();
		}

		if (!question.textAnswerKey) {
			// text answer is not expected for this question
			return;
		}

		await this.onAnswer({
			client,
			channel,
			formName: dbRecord.formName,
			member: message.member,
			message,
			question,
			nextQuestionId: question.next,
			isSubmit: question.isSubmit,
			answerData: {
				textAnswers: [ {
					key: question.textAnswerKey,
					text: messageText,
				} ]
			}
		});
	}

	_buildNicknameFromAnswers(dbRecord, globalName) {
		const textAnswers = this._getTextAnswersObject(dbRecord);
		let { nickname, name, regiment } = textAnswers;

		nickname ||= globalName || "";
		let result = `${regiment || ""} ${nickname}`.trim();
		if (name) {
			result += ` (${name})`;
		}

		return result.substring(0, 32);
	}

	_getTextAnswersObject(dbRecord) {
		const resultTextAnswers = {};
		dbRecord.answers.forEach(({ textAnswers }) => {
			if (!textAnswers?.length) {
				return;
			}

			textAnswers.forEach(({ key, text }) => resultTextAnswers[key] = text);
		});

		return resultTextAnswers;
	}

	async stringSelect({ interaction, client }) {
		const { questionId, formName } = interaction.customData;
		const question = this._getQuestionById(questionId, formName);

		const selectValues = interaction.values || [];
		const option = question.select.options.find((o) => o.text === selectValues[0]);

		await this.onAnswer({
			client,
			interaction,
			formName,
			channel: interaction.channel,
			member: interaction.member,
			message: interaction.message,
			question,
			nextQuestionId: option?.next || question.next,
			isSubmit: question.isSubmit,
			answerData: { selectValues }
		});
	}

	async submitModal({ interaction, client }) {
		const { questionId, formName } = interaction.customData;
		const question = this._getQuestionById(questionId, formName);
		if (!question.modal?.items?.length) {
			return;
		}

		const answers = getModalAnswers(question.modal, interaction.fields);
		const textAnswers = Object.keys(answers).map((key) => ({
			key,
			text: answers[key]
		}));

		await this.onAnswer({
			client,
			interaction,
			formName,
			channel: interaction.channel,
			member: interaction.member,
			message: interaction.message,
			question,
			nextQuestionId: question.next,
			isSubmit: question.isSubmit,
			answerData: {
				textAnswers
			}
		});
	}

	async onAnswer({ client, interaction, formName, channel, member, message, question, nextQuestionId, isSubmit, answerData = {} }) {
		const questionId = question.id;
		const memberId = member.id;

		let dbRecord = await Models.Form.findOne({ memberId, formName, channelId: channel.id, completed: { $ne: true } }).lean();
		if (!dbRecord) {
			return;
		}

		if (questionId !== dbRecord.currentQuestionId) {
			const messageDate = message.createdTimestamp;
			await this.processAnswerOnPrevQuestion({ messageDate, dbRecord, channel, questionId });
		}

		dbRecord.answers.push({ questionId, ...answerData });
		dbRecord = await Models.Form.findOneAndUpdate(
			{ _id: dbRecord._id },
			{ answers: dbRecord.answers, dateUpdated: new Date() },
			{ new: true }
		);

		if (nextQuestionId) {
			const nextQuestion = this._getQuestionById(nextQuestionId, formName);
			await this.sendQuestion({ dbRecord, question: nextQuestion, channel, interaction, formName });
		} else if (isSubmit) {
			await this.submit({ interaction, dbRecord, member, channel, client, formName });
		}
	}

	async submit({ interaction, dbRecord, member, channel, client, formName }) {
		const promises = [];
		const form = this.getFormByName(formName);
		const nickname = this._buildNicknameFromAnswers(dbRecord, member.user.globalName);
		if (nickname) {
			promises.push(member.setNickname(nickname));
		}

		promises.push(
			this._changeResultRoles(dbRecord.answers, member, formName),
			Models.Form.updateOne(
				{ _id: dbRecord._id },
				{ completed: true, currentQuestionId: null,	dateUpdated: new Date() }
			),
			customIdService.clearCustomId({ channelId: channel.id })
		);

		try {
			await Promise.all(promises);
		} catch (err) {
			logError(err);
			if (err.message !== "Missing Permissions") {
				throw err;
			}
		}

		if (form.resultChannelId) {
			await this.sendResult({ dbRecord, client, member, nickname, formName });
		}

		await interaction.reply(local.formSubmitReply);
		const shouldDeleteBranch = !this._checkShouldPreserveBranch(dbRecord.answers, formName);
		if (shouldDeleteBranch) {
			await channel.delete();
		}
	}

	_checkShouldPreserveBranch(answers, formName) {
		for (let { questionId, buttonIndex, selectValues } of answers) {
			const question = this._getQuestionById(questionId, formName);
			if (buttonIndex || buttonIndex === 0) {
				const button = getButtonsFlat(question.buttons)[buttonIndex];
				if (button.preserveBranch) {
					return true;
				}
			} else if (selectValues?.length) {
				const options = this._getSelectOptionsByValues(question.select.options, selectValues);
				const preserveBranch = !!options.find(o => o.preserveBranch);
				if (preserveBranch) {
					return true;
				}
			}
		}

		return false;
	}

	async _changeResultRoles(answers, member, formName) {
		const rolesAdd = [];
		const rolesRemove = [];

		answers.forEach(({ questionId, buttonIndex, selectValues }) => {
			const question = this._getQuestionById(questionId, formName);
			if (buttonIndex || buttonIndex === 0) {
				const button = getButtonsFlat(question.buttons)[buttonIndex];
				rolesAdd.push(...(button.rolesAdd || []));
				rolesRemove.push(...(button.rolesRemove || []));
			} else if (selectValues?.length) {
				const options = this._getSelectOptionsByValues(question.select.options, selectValues);
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

	_getSelectOptionsByValues(options, values) {
		return options.filter((o) => values.includes(o.text));
	}

	async sendResult({ dbRecord, client, member, nickname, formName }) {
		const form = this.getFormByName(formName);

		const resultChannelId = form.resultChannelId;
		const channel = await client.channels.fetch(resultChannelId);

		const resultHeader = this._prepareMessageText(form.resultHeader, {
			name: nickname || member.user.globalName,
			memberId: member.id
		});
		const resultText = this.prepareResultText({ answers: dbRecord.answers, formName, member });

		const embed = createEmbed({ description: resultText });
		await channel.send({ embeds: [ embed ], content: resultHeader });
	}

	prepareResultText({ answers, formName, member }) {
		let result = "";
		answers.forEach(({ questionId, buttonIndex, textAnswers, selectValues }) => {
			const question = this._getQuestionById(questionId, formName);
			if (question.hideInResult) {
				return;
			}

			if (question.modal) {
				let questionDataText = "";
				question.modal.items.forEach(({ label, key, resultText }) => {
					let textAnswer = textAnswers.find((t) => t.key === key);
					if (!textAnswer) {
						textAnswer = textAnswers.find((t) => t.key === label);
					}

					if (!textAnswer?.text) {
						return;
					}

					questionDataText += `Q: ${resultText || label || ""}:\nA: ${textAnswer.text}\n`;
				});

				result += questionDataText + "\n";
				return;
			}

			let questionDataText = `Q: ${question.resultText || question.text || ""}:\nA: `;
			if (buttonIndex || buttonIndex === 0) {
				const button = getButtonsFlat(question.buttons)[buttonIndex];
				if (button.hideInResult) {
					return;
				}
				questionDataText += `${button.emoji || ""} ${button.resultText || button.text || ""}`.trim();
			} else if (textAnswers?.length === 1) {
				questionDataText += textAnswers[0].text;
			} else if (selectValues?.length) {
				const optionsTexts = [];
				question.select.options.forEach((option) => {
					if (option.hideInResult) {
						return;
					}
					const userValue = selectValues.find((value) => value === option.text);
					if (userValue) {
						optionsTexts.push(option.resultText || option.text || "");
					}
				});
				if (!optionsTexts.length) {
					return;
				}
				questionDataText += optionsTexts.join(", ");
			}

			result += this._prepareMessageText(questionDataText, { memberId: member.id }) + "\n\n";
		});

		return result.trim();
	}

	async processAnswerOnPrevQuestion({ messageDate, dbRecord, channel, questionId }) {
		const answerIndex = dbRecord.answers.findIndex((a) => a.questionId === questionId);
		if (answerIndex !== -1) {
			dbRecord.answers = dbRecord.answers.slice(0, answerIndex);
			await removeMessagesAfterDate(channel, messageDate);
		}
	}

	async clearOldForms(client) {
		const formItems = await Models.Form.find({ completed: { $ne: true } });
		const hasAuthForms = !!formItems.find(({ formName }) => formName === this.formsNames.auth);

		let members;
		if (hasAuthForms) {
			const guild = await client.guilds.fetch(configService.guildId);
			members = await getGuildMembers(guild);
		}

		for (let item of formItems) {
			const expirationDate = new Date(new Date(item.dateUpdated).getTime() + 7 * 24 * 60 * 60 * 1000);
			if (Date.now() < expirationDate.getTime()) {
				continue;
			}

			await this.clearOldMemberData({
				client,
				memberId: item.memberId,
				formName: item.formName
			});

			if (item.formName === this.formsNames.auth) {
				const member = members.find(({ user }) => user.id === item.memberId);
				await this._kickAuthMember(member);
			}
		}
	}

	async _kickAuthMember(member) {
		if (!member) {
			return;
		}

		const formConfig = this.getFormByName(this.formsNames.auth);
		let hasException = false;
		if (formConfig.kickExceptionRoles?.length) {
			hasException = !!member.roles.cache.find(r => formConfig.kickExceptionRoles.includes(r.id));
		}

		if (!hasException) {
			await member.kick();
		}
	}
}

module.exports = new FormsService();
