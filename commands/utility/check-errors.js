const {
	SlashCommandBuilder,
	PermissionFlagsBits,
} = require("discord.js");
const { commandsPermission } = require("../../config.json");

const NAME = getCommandName(__filename);

module.exports = {
	name: NAME,
	data: new SlashCommandBuilder()
		.setName(NAME)
		.addStringOption(option => option.setName("count").setDescription("Количество").setRequired(false))
		.setDescription("Возвращает последние ошибки")
		.setDefaultMemberPermissions(PermissionFlagsBits[commandsPermission])
		.setDMPermission(false),

	async execute(interaction) {
		const count = interaction.options.getString("count") || 1;
		const content = (getLastErrors(count) || "Пусто");
		if (content.length > 1990) {
			await sendLongMessage(content, (text) => interaction.channel.send(text));
		} else {
			await interaction.reply({ content, ephemeral: true });
		}
	},
};
