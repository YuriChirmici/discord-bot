module.exports = {
	part: "Часть",
	errorDetails: "Ошибка: {{details}}",

	adRemoveCommandDesc: "Удаляет роли, выданные через объявления",
	adRemoveReply: "Роли будут очищены в ближайшее время",

	adStatRemoveCommandDesc: "Очищает статистику",
	adStatRemoveConfirm: "Подтвердить",
	adStatRemoveSuccess: "Статистика очищена!",
	adStatCommandDesc: "Показывает статистику ролей, выданных через объявление",
	adStatUserParamDesc: "Пользователь",
	adStatReplyContent: "Статистика:",

	adCommandDesc: "Создает объявление. Типы: {{types}}",
	adNameParamDesc: "Название объявления",
	adChannelParamDesc: "Целевой канал",
	adTimerParamDesc: "Таймер для удаления объявления (минуты)",
	adTitleParamDesc: "Заголовок эмбеда",
	adTextParamDesc: "Текст эмбеда",
	adDateParamDesc: "Дата",
	adTimeParamDesc: "Время",
	adClearRolesParamDesc: "Снятие ролей после удаления предыдущего объявления",
	adWrongTypeErr: "Неверные название или тип объявления",
	adAttendanceReply: "Объявление будет создано после очистки предыдущего.",
	memberCommandsClearChoice: "Сброс выбора",
	roleRemoved: "Роль {{role}} очищена",
	rolesRemoved: "Роли {{role}} очищены",
	roleAdded: "Роль {{role}} добавлена",
	rolesAdded: "Роли {{role}} добавлены",
	roleChanged: "Роль изменена на {{role}}",
	rolesChanged: "Роли изменены на {{role}}",

	updateNicknamesCommandDesc: "Обновляет файл с никами",
	updateNicknamesFileParamDesc: "CSV файл с никами",
	updateNicknamesReply: "Команда будет обработана в ближайшее время.",

	updateRatingCommandDesc: "Обновлять рейтинговые роли",
	updateRatingReply: "Команда будет обработана в ближайшее время.",
	adRatingRolesUpdateResult: "Результат обновления рейтинговых ролей:",

	authTestCommandDesc: "Тест авторизации",
	authTestReply: "Заявка создана, перейдите в ветку <#{{channelId}}>",

	pingCommandDesc: "Проверка",
	pingReply: "Pong",

	formSubmitReply: "Результат сохранён!",
	startedFormExistErr: "Заявка уже создана, перейдите в ветку <#{{channelId}}>",
	formStartedReply: "Заявка создана успешно, перейдите в ветку <#{{channelId}}>",
	modalSubmitReply: "Результат сохранён!",

	vacationErr1: "Дата окончания отпуска должна быть минимум на день позже его начала!",
	vacationErr2: "Дата окончания отпуска не может быть раньше сегодняшнего дня!",
	vacationStartValidationErr: "Неверный формат даты начала отпуска!",
	vacationEndValidationErr: "Неверный формат даты окончания отпуска!",
	endVacationErr: "Вы сейчас не в отпуске!",
	endVacationSuccess: "Вы вышли из отпуска!",
	endVacationResult: "Пользователь <@{{memberId}}> досрочно вышел из отпуска.",

	roleResizeCommand: "Изменяет длину роли на указанную длину, добавляя невидимые символы",
	roleResizeParamRole: "Роль",
	roleResizeParamSize: "Целевой размер (в пикселях)",
};
