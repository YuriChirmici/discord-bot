const { createCanvas } = require("canvas");

class TextResizingService {
	constructor() {
		// eslint-disable-next-line no-unused-vars
		const invisibleSymbols = "       ㅤ";

		this.customFontName = "gg sans";
		this._initContext();

		this.maxSize = 200;
		this.emojiSize = this.context.measureText("🏅").width;
		this.actualEmojiSize = 16.4765625;
		this.lastInvisibleSymbol = "ㅤ";
		this.lastSymbolSize = this.getTextWidth(this.lastInvisibleSymbol);
		this.lastSymbolActualSize = 12;
		this.discordInvisibleSymbolSize = 2;
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
		const emojisNumber = this._getEmojisCount(text);
		return this.context.measureText(text).width - emojisNumber * (this.emojiSize - this.actualEmojiSize);
	}

	_getEmojisCount(text) {
		const emojiRegex = /[\p{Emoji_Presentation}\p{Emoji}\p{Extended_Pictographic}]/gu;
		const matches = text.match(emojiRegex);
		const digits = this._countDigits(text);

		const count = (matches?.length || 0) - digits;

		return count < 0 ? 0 : count;
	}

	_countDigits(text) {
		const digitRegex = /\d/g;
		const matches = text.match(digitRegex);
		return matches?.length || 0;
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

