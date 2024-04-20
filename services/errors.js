const errors = [];
const maxLength = 20;

global.logError = (err) => {
	console.log(err);

	errors.push(err);
	if (errors.length > maxLength) {
		errors.shift();
	}
};

global.getLastErrors = (count = 1) => {
	return errors.slice(errors.length - count).join("\n\n").trim();
};
