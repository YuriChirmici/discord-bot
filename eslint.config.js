const globals = require("globals");
const pluginJs = require("@eslint/js");

module.exports = [
	{
		files: [ "**/*.js" ],
		languageOptions: {
			sourceType: "commonjs"
		}
	},
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				logError: true,
				getCommandName: true
			},
		},
		rules: {
			"arrow-spacing": [ "warn", { "before": true, "after": true } ],
			"brace-style": [ "error", "1tbs" ],
			"comma-spacing": "error",
			"comma-style": "error",
			"curly": [ "error", "multi-line", "consistent" ],
			"dot-location": [ "error", "property" ],
			"handle-callback-err": "off",
			"indent": [ "error", "tab" ],
			"keyword-spacing": "error",
			"max-nested-callbacks": [ "error", { "max": 4 } ],
			"max-statements-per-line": [ "error", { "max": 2 } ],
			"no-console": "off",
			"no-empty-function": "error",
			"no-floating-decimal": "error",
			"no-multi-spaces": "error",
			"no-multiple-empty-lines": [ "error", { "max": 1, "maxEOF": 1, "maxBOF": 0 } ],
			"no-shadow": [ "error", { "allow": [ "err", "resolve", "reject" ] } ],
			"no-trailing-spaces": [ "error" ],
			"no-var": "error",
			"object-curly-spacing": [ "error", "always" ],
			"array-bracket-spacing": [ "error", "always" ],
			"quotes": [ "error", "double" ],
			"semi": [ "error", "always" ],
			"space-before-blocks": "error",
			"space-before-function-paren": [ "error", {
				"anonymous": "never",
				"named": "never",
				"asyncArrow": "always"
			} ],
			"space-in-parens": "error",
			"space-infix-ops": "error",
			"space-unary-ops": "error",
			"spaced-comment": "error",
			"yoda": "error",
			"eol-last": [ "error", "always" ],
			"no-empty": [ "error", { "allowEmptyCatch": true } ]
		}
	},
	pluginJs.configs.recommended
];
