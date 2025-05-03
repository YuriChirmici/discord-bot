const dbService = require("../database");

class CustomIdService {
	async createCustomId(data) {
		const item = await dbService.Models.CustomId.create(data);
		return item._id.toString();
	}

	async getDataFromCustomId(customId, remove = false) {
		if (!customId) {
			return;
		}

		const dbItem = await dbService.Models.CustomId.findById(customId).lean();
		if (!dbItem) {
			return;
		}

		if (remove) {
			await dbService.Models.CustomId.deleteOne({ _id: customId });
		}

		return {
			...dbItem.data,
			commandName: dbItem.commandName
		};
	}

	async clearCustomId(query) {
		await dbService.Models.CustomId.deleteMany(query);
	}
}

module.exports = new CustomIdService();
