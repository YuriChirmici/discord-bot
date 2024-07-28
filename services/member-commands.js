const formsService = require("./forms");
const customIdService = require("./custom-id");
const configService = require("./config");
const profileService = require("./profile");
const { createModal, getDateFormatted, getModalAnswers, createEmbed } = require("./helpers");
const { Models } = require("../database");
const localizationService = require("./localization");

const local = localizationService.getLocal();

class MemberCommandsService {
	constructor() {
		this.NAME = "memberCommands";

		this.commandsTypes = {
			form: "form",
			modal: "modal",
			action: "action",
		};

		this.clearSelectOptionValue = "clearSelect";
		this.vacationCommandName = "vacation";
	}

	async executeCommand(args) {
		const command = this.getCommandByName(args.commandName);
		if (!this.commandsTypes[command.type]) {
			logError(new Error("No command for type: ") + command.type);
			return;
		}

		const funcName = `_processCommand_${command.type}`;
		await this[funcName]({ ...args, command });
	}

	async _processCommand_form({ interaction, client, command }) {
		const oldForm = await Models.Form.findOne({
			memberId: interaction.member.id,
			formName: command.name,
			completed: { $ne: true }
		});

		if (oldForm) {
			await interaction.reply({
				content: local.startedFormExistErr.replace("{{channelId}}", oldForm.channelId),
				ephemeral: true
			});
			return;
		}

		const { channel } = await formsService.startForm({
			interaction,
			member: interaction.member,
			client,
			formName: command.name
		});

		await interaction.reply({
			content: local.formStartedReply.replace("{{channelId}}", channel.id),
			ephemeral: true
		});
	}

	async _processCommand_modal({ interaction, command }) {
		const customIdData = { commandName: this.NAME, data: { selectedCommand: command.name } };
		const customId = await customIdService.createCustomId(customIdData);
		const modalData = this._prepareModalData(command.modal, command.name);
		const modal = createModal(customId, modalData);
		await interaction.showModal(modal);
	}

	async _processCommand_action(args) {
		return await this[`_action_${args.command.name}`](args);
	}

	_prepareModalData(modal, commandName) {
		const modalData = JSON.parse(JSON.stringify(modal));
		if (commandName === this.vacationCommandName) {
			const dateStartItem = modalData.items.find(({ key }) => key === "vacationStart");
			dateStartItem.value = getDateFormatted(new Date());
		}

		return modalData;
	}

	async submitModal({ interaction, client }) {
		const { selectedCommand } = interaction.customData;
		const command = this.getCommandByName(selectedCommand);
		if (!command) {
			return;
		}

		const result = await this._getModalResult({ interaction, command });
		if (command.resultChannelId && result?.resultText) {
			await this.sendModalResult({ interaction, client, command, resultText: result.resultText });
		}

		if (result?.userReply) {
			await interaction.reply({ content: result.userReply, ephemeral: true });
		}
	}

	async sendModalResult({ interaction, client, command, resultText }) {
		const channel = await client.channels.fetch(command.resultChannelId);
		const content = (command.resultHeader || "").replace("{{userTag}}", `<@${interaction.member.id}>`) + "\n";
		const embed = createEmbed({	description: resultText });
		await channel.send({ embeds: [ embed ], content });
	}

	async _getModalResult({ interaction, command }) {
		const answers = getModalAnswers(command.modal, interaction.fields);
		let customResult;
		let userReplyResult = command.userReplyResult;
		if (command.name === this.vacationCommandName) {
			customResult = await this._processVacationSubmit({ interaction, answers });
			if (customResult.endDate && command.userReplyResult) {
				userReplyResult = command.userReplyResult
					.replace("{{endDate}}", getDateFormatted(customResult.endDate))
					.replace("{{startDate}}", getDateFormatted(customResult.startDate));
			}
		}

		if (customResult?.hasError) {
			return;
		}

		const resultText = this.prepareModalResult(command, answers);
		const userReply = userReplyResult || local.modalSubmitReply;

		return { resultText, userReply };
	}

	async _processVacationSubmit({ interaction, answers }) {
		const vacationError = this._getDateValidationErr(answers.vacationStart, answers.vacationEnd);
		if (vacationError) {
			await interaction.reply({
				content: local.errorDetails.replace("{{details}}", vacationError),
				ephemeral: true
			});
			return { hasError: true };
		}

		const { startDate, endDate } = this._createVacationDates(answers.vacationStart, answers.vacationEnd);

		await profileService.createOrUpdate(interaction.member.id, {
			vacationStart: startDate,
			vacationEnd: endDate,
		});

		return { startDate, endDate };
	}

	_getDateValidationErr(startDateStr, endDateStr) {
		const requiredErr = this._getDateRequiredErr(startDateStr, true) || this._getDateRequiredErr(endDateStr);
		if (requiredErr) {
			return requiredErr;
		}

		const { startDate, endDate } = this._createVacationDates(startDateStr, endDateStr);
		if (endDate.getTime() < startDate.getTime() + 24 * 60 * 60 * 1000) {
			return local.vacationErr1;
		} else if (endDate.getTime() < Date.now()) {
			return local.vacationErr2;
		}
	}

	_createVacationDates(startDateStr, endDateStr) {
		return {
			startDate: this._createDate(startDateStr),
			endDate: this._createDate(endDateStr),
		};
	}

	_getDateRequiredErr(dateStr = "", isStart) {
		const [ day, month, year ] = this._getDateParts(dateStr);
		if (!day || !month || !year) {
			return isStart ? local.vacationStartValidationErr : local.vacationEndValidationErr;
		}
	}

	_createDate(dateStr = "") {
		const [ day, month, year ] = this._getDateParts(dateStr);
		const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
		return date;
	}

	_getDateParts(dateStr = "") {
		return dateStr.split(".").map((v) => +v);
	}

	prepareModalResult(command, answers) {
		let result = "";
		command.modal.items.forEach(({ label, key, resultText }) => {
			let textAnswer = answers[key] || answers[label];
			if (!textAnswer) {
				return;
			}

			result += `Q: ${resultText || label || ""}:\nA: ${textAnswer}\n`;
		});

		return result.trim();
	}

	getCommandByName(name) {
		return configService.memberCommands.find((c) => c.name === name);
	}

	async runVacationStart(client) {
		await this.runVacationRolesChange(client, true);
	}

	async runVacationEnd(client) {
		await this.runVacationRolesChange(client);
	}

	async runVacationRolesChange(client, isStart) {
		const profileQueryKey = isStart ? "vacationStart" : "vacationEnd";

		const vacationRoles = this.getCommandByName(this.vacationCommandName).vacationRoles;
		const [ guild, profiles ] = await Promise.all([
			client.guilds.fetch(configService.guildId),
			Models.Profile.find({ [profileQueryKey]: { $exists: true, $ne: null } })
		]);

		const membersRaw = await guild.members.fetch();
		const members = Array.from(membersRaw.values());

		const promises = [];

		for (let profile of profiles) {
			if (profile[profileQueryKey].getTime() > Date.now()) {
				continue;
			}

			const member = members.find(({ id }) => id == profile.memberId);
			if (member) {
				promises.push(member.roles[isStart ? "add" : "remove"](vacationRoles));
			}

			promises.push(profileService.createOrUpdate(member.id, { [profileQueryKey]: null }));
		}

		await Promise.all(promises);
	}

	async _action_endVacation({ interaction, client }) {
		const member = interaction.member;
		const command = this.getCommandByName(this.vacationCommandName);

		const profile = await Models.Profile.findOne({ memberId: member.id });
		if (!profile?.vacationEnd) {
			await interaction.reply({
				content: local.endVacationErr,
				ephemeral: true
			});
			return;
		}

		await Promise.all([
			member.roles.remove(command.vacationRoles),
			profileService.createOrUpdate(member.id, { vacationStart: null, vacationEnd: null })
		]);

		await interaction.reply({
			content: local.endVacationSuccess,
			ephemeral: true
		});

		if (command.resultChannelId) {
			const channel = await client.channels.fetch(command.resultChannelId);
			await channel.send(local.endVacationResult.replace("{{memberId}}", member.id));
		}
	}
}

module.exports = new MemberCommandsService();
