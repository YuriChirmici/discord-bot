const main = require("../config/main.json");
const ads = require("../config/ads.json");
const memberCommands = require("../config/member-commands.json");

const appConfigType = "app-config"; // TODO: move to consts?

module.exports = {
	async up(db) {
		    const configToInsert = {
			type: appConfigType,
			config: {
				...main,
				...ads,
				...memberCommands,
			},
		};

		const existing = await db.collection("configs").findOne({ type: configToInsert.type });
		if (!existing) {
			await db.collection("configs").insertOne(configToInsert);
		} else {
			console.log("Config with this type already exists, skipping.");
		}
	},

	async down(db) {
		await db.collection("configs").deleteOne({ type: appConfigType });
		console.log("Config removed");
	}
};
