const { Models } = require("../database");

class CustomIdService {
	async createCustomId(data) {
		const item = await Models.CustomId.create(data);
		return item._id.toString();
	}

	async getDataFromCustomId(customId, remove = false) {
		if (!customId) {
			return;
		}

		const dbItem = await Models.CustomId.findById(customId).lean();
		if (!dbItem) {
			return;
		}

		if (remove) {
			await Models.CustomId.deleteOne({ _id: customId });
		}

		return {
			...dbItem.data,
			commandName: dbItem.commandName
		};
	}

	async clearCustomId(query) {
		await Models.CustomId.deleteMany(query);
	}
}

module.exports = new CustomIdService();
