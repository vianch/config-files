/** @type {import('@types/eslint').Linter.BaseConfig} */
module.exports = {
	env: {
		browser: true,
		commonjs: true,
	},
	root: true,
	parser: "@typescript-eslint/parser",
	plugins: ["@typescript-eslint", "prettier", "react"],
	extends: [
		"airbnb-base",
		"airbnb-typescript",
		"eslint:recommended",
		"prettier",
		"plugin:@next/next/recommended",
		"plugin:react/recommended",
		"plugin:prettier/recommended",
		"next/core-web-vitals",
		"plugin:@typescript-eslint/eslint-recommended",
		"plugin:@typescript-eslint/recommended",
	],
	overrides: [
		{
			env: {
				node: true,
			},
			files: ["*.ts", "*.tsx"],
			parserOptions: {
				sourceType: "script",
			},
		},
	],
	parserOptions: {
		project: "./tsconfig.json",
	},
	rules: {
		"prettier/prettier": "error",
		"react-hooks/exhaustive-deps": "off",
		"no-console": "error",
		"@next/next/no-img-element": "off",
		"@next/next/next-script-for-ga": "off",
		"@next/next/no-css-tags": "off",
		"@typescript-eslint/no-unused-vars": ["error"],
		"react/react-in-jsx-scope": "off",
		// allow jsx syntax in js files (for next.js project)
		"react/jsx-filename-extension": [
			1,
			{ extensions: [".js", ".jsx", ".ts", ".tsx"] },
		],
		"padding-line-between-statements": [
			"error",
			{ blankLine: "always", prev: "block", next: "*" },
			{ blankLine: "always", prev: "*", next: "block-like" },
			{ blankLine: "always", prev: "block-like", next: "*" },
			{ blankLine: "always", prev: ["case", "default"], next: "*" },
			{ blankLine: "always", prev: "block-like", next: "block-like" },
			{ blankLine: "always", prev: "*", next: "return" },
			{ blankLine: "always", prev: "*", next: "if" },
			{ blankLine: "always", prev: "*", next: "for" },
			{
				blankLine: "always",
				prev: ["const", "let", "var"],
				next: "*",
			},
			{
				blankLine: "any",
				prev: ["const", "let", "var"],
				next: ["const", "let", "var"],
			},
			{ blankLine: "always", prev: "directive", next: "*" },
			{ blankLine: "any", prev: "directive", next: "directive" },
		],
		"lines-between-class-members": [
			"error",
			"always",
			{ exceptAfterSingleLine: true },
		],
	},
	settings: {
		react: {
			createClass: "createReactClass", // Regex for Component Factory to use,
			// default to "createReactClass"
			pragma: "React", // Pragma to use, default to "React"
			fragment: "Fragment", // Fragment to use (may be a property of <pragma>), default to "Fragment"
			version: "detect", // React version. "detect" automatically picks the version you have installed.
			// You can also use `16.0`, `16.3`, etc, if you want to override the detected value.
			// default to latest and warns if missing
			// It will default to "detect" in the future
			flowVersion: "0.53", // Flow version
		},
		propWrapperFunctions: [
			// The names of any function used to wrap propTypes, e.g. `forbidExtraProps`. If this isn't set, any propTypes wrapped in a function will be skipped.
			"forbidExtraProps",
			{ property: "freeze", object: "Object" },
			{ property: "myFavoriteWrapper" },
		],
		componentWrapperFunctions: [
			// The name of any function used to wrap components, e.g. Mobx `observer` function. If this isn't set, components wrapped by these functions will be skipped.
			"observer", // `property`
			{ property: "styled" }, // `object` is optional
			{ property: "observer", object: "Mobx" },
			{ property: "observer", object: "<pragma>" }, // sets `object` to whatever value `settings.react.pragma` is set to
		],
		linkComponents: [
			// Components used as alternatives to <a> for linking, eg. <Link to={ url } />
			"Hyperlink",
			{ name: "Link", linkAttribute: "to" },
		],
	},
};
