const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const gameTrackingService = require("../../services/game-tracking");
const customIdService = require("../../services/custom-id");
const { createSelect } = require("../../services/helpers");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	get() {
		return new SlashCommandBuilder()
			.setName(NAME)
			.setDescription("Получить информацию о последних матчах игрока")
			.setDefaultMemberPermissions(PermissionFlagsBits.UseExternalSounds) // workaround for the missing permissions functionality
			.addStringOption(option => option
				.setName("nickname")
				.setDescription("Ник игрока")
				.setMinLength(2)
				.setRequired(true)
			)
			.addStringOption(option => option
				.setName("clan")
				.setDescription("Клан игрока (необязательно)")
				.setMinLength(2)
			)
			.setDMPermission(false);
	},

	async execute({ interaction }) {
		await interaction.reply({ ephemeral: true, content: "Получаю результат..." });

		const nickname = interaction.options.getString("nickname").trim();
		const clanTag = (interaction.options.getString("clan") || "").trim();

		if (!clanTag) {
			await this.sendEnemyLastGamesStatsMessage(interaction, nickname);
			return;
		}

		const { clan } = await gameTrackingService.clansStoreService.fetchClanByTag(clanTag);
		if (!clan) {
			const info = await gameTrackingService.getEnemyLastGamesStats(nickname);
			if (info.errorMessage) {
				await interaction.channel.send(`Клан с тэгом "${clanTag}" не найден. Игрок с ником "${nickname}" тоже не найден.`);
			} else {
				await gameTrackingService.sendStatInfo({ channel: interaction.channel, ...info });
			}
			return;
		}

		const members = clan.members.filter(m => m.nick.toLowerCase().includes(nickname.toLowerCase()));
		if (!members.length) {
			await interaction.channel.send(`Игрок с символами "${nickname}" не найден в клане ${clan.name}`);
		} else if (members.length === 1) {
			await this.sendEnemyLastGamesStatsMessage(interaction, members[0].nick);
		} else {
			const content = `Найдено несколько игроков с символами "${nickname}", выберите нужного:`;
			const select = await this._createSelectWithMembers(members);
			await interaction.channel.send({
				content,
				components: [ select ]
			});
		}
	},

	async _createSelectWithMembers(members) {
		const customIdData = { commandName: this.name, data: { type: "clanMembers" } };
		const customId = await customIdService.createCustomId(customIdData);
		const select = createSelect(customId, {
			placeholder: "Выберите игрока",
			options: members.map(m => ({ text: m.nick })),
		});

		return select;
	},

	async stringSelect({ interaction }) {
		const data = await customIdService.getDataFromCustomId(interaction.customId, true);
		if (!data) {
			return;
		}

		if (data.type === "clanMembers") {
			await interaction.reply({ ephemeral: true, content: "Получаю результат..." });
			const selectedNickname = (interaction.values || [])[0];
			await this.sendEnemyLastGamesStatsMessage(interaction, selectedNickname);
			await interaction.message.delete();
			return;
		}
	},

	async sendEnemyLastGamesStatsMessage(interaction, nickname) {
		const info = await gameTrackingService.getEnemyLastGamesStats(nickname);
		if (info.errorMessage) {
			await interaction.channel.send(info.errorMessage);
			return;
		}

		await gameTrackingService.sendStatInfo({ channel: interaction.channel, ...info });
	}
};
