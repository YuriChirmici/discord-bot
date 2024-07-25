const formsService = require("./forms");
const customIdService = require("./custom-id");
const configService = require("./config");
const profileService = require("./profile");
const { createModal, getDateFormatted, getModalAnswers } = require("./helpers");
const { Models } = require("../database");

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
		const oldForm = await formsService.getIncompleteForm(interaction.member.id, command.name);
		if (oldForm) {
			await interaction.reply({
				content: `Заявка уже создана, перейдите в ветку <#${oldForm.channelId}>`,
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
			content: `Заявка создана, перейдите в ветку <#${channel.id}>`,
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
			if (dateStartItem) {
				const date = new Date();
				date.setMinutes(date.getMinutes() + 24 * 60);
				dateStartItem.value = getDateFormatted(date);
			}
		}

		return modalData;
	}

	async submitModal({ interaction, client }) {
		const { selectedCommand } = interaction.customData;
		const command = this.getCommandByName(selectedCommand);
		if (!command) {
			return;
		}

		const result = await this.processVacationSubmit({ interaction, command });
		if (command.resultChannelId && result) {
			const channel = await client.channels.fetch(command.resultChannelId);
			await channel.send(result);
		}
	}

	async processVacationSubmit({ interaction, command }) {
		const answers = getModalAnswers(command.modal, interaction.fields);
		const vacationError = this._getDateValidationErr(answers.vacationStart, answers.vacationEnd);
		if (vacationError) {
			await interaction.reply({
				content: "Ошибка: " + vacationError,
				ephemeral: true
			});
			return;
		}

		const { startDate, endDate } = this._createVacationDates(answers.vacationStart, answers.vacationEnd);

		await profileService.createOrUpdate(interaction.member.id, {
			vacationStart: startDate,
			vacationEnd: endDate,
		});

		const result = this.prepareModalResult(command, answers, interaction.member);

		await interaction.reply({
			content: `Отпуск до ${getDateFormatted(endDate)} записан. Приятного отдыха!`,
			ephemeral: true
		});

		return result;
	}

	_getDateValidationErr(startDateStr, endDateStr) {
		const requiredErr = this._getDateRequiredErr(startDateStr, true) || this._getDateRequiredErr(endDateStr);
		if (requiredErr) {
			return requiredErr;
		}

		const { startDate, endDate } = this._createVacationDates(startDateStr, endDateStr);
		if (endDate.getTime() < startDate.getTime() + 24 * 60 * 60 * 1000) {
			return "Дата окончания отпуска должна быть минимум на день позже его начала!";
		} else if (endDate.getTime() < Date.now()) {
			return "Дата окончания отпуска не может быть раньше сегодняшнего дня!";
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
			if (isStart) {
				return "Неверный формат даты начала отпуска!";
			} else {
				return "Неверный формат даты окончания отпуска!";
			}
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

	prepareModalResult(command, answers, member) {
		let result = (command.resultHeader || "").replace("@User", `<@${member.id}>`) + "\n";
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
				content: "Вы сейчас не в отпуске!",
				ephemeral: true
			});
			return;
		}

		await Promise.all([
			member.roles.remove(command.vacationRoles),
			profileService.createOrUpdate(member.id, { vacationStart: null, vacationEnd: null })
		]);

		await interaction.reply({
			content: "Вы вышли из отпуска!",
			ephemeral: true
		});

		if (command.resultChannelId) {
			const channel = await client.channels.fetch(command.resultChannelId);
			await channel.send(`Пользователь <@${member.id}> досрочно вышел из отпуска.`);
		}
	}
}

module.exports = new MemberCommandsService();
