const { createCanvas } = require("canvas");
const emojiRegex = require("emoji-regex");

class TextResizingService {
	constructor() {
		// eslint-disable-next-line no-unused-vars
		const invisibleSymbols = "       ㅤ";

		this.customFontName = "gg sans";
		this._initContext();

		this.maxSize = 200;
		this.actualEmojiSize = 16.4765625;
		this.lastInvisibleSymbol = "ㅤ";
		this.lastSymbolSize = this.getTextWidth(this.lastInvisibleSymbol);
		this.lastSymbolActualSize = 12;
		this.invisibleSymbol = " ";
		this.invisibleSymbolSize = this.getTextWidth(this.invisibleSymbol);
	}

	_initContext() {
		const fontSize = 12;
		const fontWeight = 500;
		this.canvas = createCanvas(800, 200);
		const context = this.canvas.getContext("2d");
		context.font = `${fontWeight} ${fontSize}px ${this.customFontName}`;
		this.context = context;
	};

	_getInvisibleRow(size, isMaxSize) {
		const symbolsNumberRaw = size / this.invisibleSymbolSize;
		const symbolsNumber = isMaxSize ? Math.trunc(symbolsNumberRaw) : Math.round(symbolsNumberRaw);
		const resultText = this.invisibleSymbol.repeat(symbolsNumber);

		return resultText;
	};

	getTextWidth(text) {
		const emojisCount = this._getEmojisCount(text);
		const clearText = this._replaceEmojis(text);
		const textSize = this.context.measureText(clearText).width + emojisCount * this.actualEmojiSize;
		return textSize;
	}

	getTextWidthPretty(text) {
		const width = this.context.measureText(text).width;
		return Math.round(width * 100) / 100;
	}

	_getEmojisCount(text) {
		const regex = emojiRegex();
		const matches = text.match(regex);
		return matches?.length || 0;
	}

	_replaceEmojis(text, replaceWith = "") {
		const regex = emojiRegex();
		return text.replace(regex, replaceWith);
	}

	resizeText(text, targetSize) {
		const textSize = this.getTextWidth(text);
		const invisibleRowSize = targetSize - textSize - this.lastSymbolActualSize;
		if (invisibleRowSize <= 0) {
			return text;
		}

		const isMaxSize = targetSize === this.maxSize;
		const invisibleRow = this._getInvisibleRow(invisibleRowSize, isMaxSize);
		const resultText = text + invisibleRow + this.lastInvisibleSymbol;

		return resultText;
	};
}

module.exports = new TextResizingService();

