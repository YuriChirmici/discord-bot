const dbService = require("../database");

class ProfileService {
	async createOrUpdate(memberId, data = {}) {
		await dbService.Models.Profile.updateOne({ memberId }, { memberId, ...data }, { upsert: true });
	}
}

module.exports = new ProfileService();
