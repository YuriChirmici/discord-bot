const { Models } = require("../database");

class ProfileService {
	async createOrUpdate(memberId, data = {}) {
		await Models.Profile.updateOne({ memberId }, { memberId, ...data }, { upsert: true });
	}
}

module.exports = new ProfileService();
