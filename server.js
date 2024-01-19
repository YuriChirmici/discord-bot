const { login } = require("./client");

(async () => {
	try {
		await login();
	} catch (err) {
		console.log(err);
	}
})();