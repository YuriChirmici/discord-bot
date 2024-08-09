const { createCanvas } = require("canvas");
const emojiRegex = require("emoji-regex");

class TextResizingService {
	constructor() {
		this.customFontName = "gg sans";
		this._initContext();

		this.maxSize = 200;
		this.actualEmojiSize = 16.4765625;
		this.lastInvisibleSymbol = "ㅤ";
		this.lastSymbolSize = this.getTextWidth(this.lastInvisibleSymbol);
		this.lastSymbolActualSize = 12;
		this.invisibleSymbol = " ";
		this.invisibleSymbolSize = this.getTextWidth(this.invisibleSymbol);
		this.textAlign = {
			left: "left",
			center: "center",
			right: "right"
		};
	}

	_initContext() {
		const fontSize = 12;
		const fontWeight = 500;
		this.canvas = createCanvas(800, 200);
		const context = this.canvas.getContext("2d");
		context.font = `${fontWeight} ${fontSize}px ${this.customFontName}`;
		this.context = context;
	};

	getTextWidth(text) {
		const emojisCount = this._getEmojisCount(text);
		const clearText = this._replaceEmojis(text);
		const textSize = this.context.measureText(clearText).width + emojisCount * this.actualEmojiSize;
		return textSize;
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

	resizeText(text, targetSize, textAlign) {
		const textSize = this.getTextWidth(text);
		const lastSymbolsNeedCount = textAlign === this.textAlign.center ? 2 : 1;
		const invisibleRowSize = targetSize - textSize - lastSymbolsNeedCount * this.lastSymbolActualSize;
		if (invisibleRowSize <= 0) {
			return text;
		}

		const invisibleSymbolsCount = Math.trunc(invisibleRowSize / this.invisibleSymbolSize);
		const resultText = this.resizeTextByAlign(text, invisibleSymbolsCount, textAlign);

		return resultText;
	}

	resizeTextByAlign(text, invisibleSymbolsCount, textAlign) {
		if (textAlign === this.textAlign.left) {
			return text + this.invisibleSymbol.repeat(invisibleSymbolsCount) + this.lastInvisibleSymbol;
		} else if (textAlign === this.textAlign.right) {
			return this.lastInvisibleSymbol + this.invisibleSymbol.repeat(invisibleSymbolsCount) + text;
		} else if (textAlign === this.textAlign.center) {
			const isEven = invisibleSymbolsCount % 2 === 0;
			const rightPart = this.invisibleSymbol.repeat(Math.trunc(invisibleSymbolsCount / 2));
			const leftPart = rightPart + (isEven ? "" : this.invisibleSymbol);
			return this.lastInvisibleSymbol + leftPart + text + rightPart + this.lastInvisibleSymbol;
		} else {
			return text;
		}
	}
}

module.exports = new TextResizingService();

