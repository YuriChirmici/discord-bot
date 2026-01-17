const { createCanvas } = require("canvas");
const emojiRegex = require("emoji-regex");

class TextResizingService {
	constructor() {
		this.customFontName = "gg sans";
		this._initContext();

		this.maxSize = 220;
		this.halfSize = Math.ceil(this.maxSize / 2) - 26;
		this.actualEmojiSize = 16.4765625;
		this.terminalInvisibleSymbol = "ㅤ";
		this.terminalSymbolSize = this.getTextWidth(this.terminalInvisibleSymbol);
		this.terminalSymbolActualSize = 12;
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
		const terminalSymbolsCount = text.split(this.terminalInvisibleSymbol).length - 1;
		const clearText = text
			.replace(emojiRegex(), "")
			.replaceAll(this.terminalInvisibleSymbol, "");

		const textSize = this.context.measureText(clearText).width +
			emojisCount * this.actualEmojiSize +
			terminalSymbolsCount * this.terminalSymbolActualSize;

		return textSize;
	}

	// remove invisible symbols and spaces from the start and end of the text
	trimText(text) {
		const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const invisibleEscaped = escapeRegex(this.invisibleSymbol);
		const terminalInvisibleEscaped = escapeRegex(this.terminalInvisibleSymbol);
		const pattern = `[${invisibleEscaped}${terminalInvisibleEscaped}\\s]`;
		const startRegex = new RegExp(`^${pattern}+`);
		const endRegex = new RegExp(`${pattern}+$`);
		return text.replace(startRegex, "").replace(endRegex, "");
	}

	_getEmojisCount(text) {
		const regex = emojiRegex();
		const matches = text.match(regex);
		return matches?.length || 0;
	}

	resizeText(text, targetSize, textAlign) {
		text = this.trimText(text);
		const textSize = this.getTextWidth(text);
		const terminalSymbolsNeedCount = textAlign === this.textAlign.center ? 2 : 1;
		const invisibleRowSize = targetSize - textSize - terminalSymbolsNeedCount * this.terminalSymbolActualSize;
		if (invisibleRowSize <= 0) {
			return text;
		}

		const invisibleSymbolsCount = Math.trunc(invisibleRowSize / this.invisibleSymbolSize);
		const resultText = this.resizeTextByAlign(text, invisibleSymbolsCount, textAlign);

		return resultText;
	}

	resizeTextByAlign(text, invisibleSymbolsCount, textAlign) {
		if (textAlign === this.textAlign.left) {
			return text + this.invisibleSymbol.repeat(invisibleSymbolsCount) + this.terminalInvisibleSymbol;
		} else if (textAlign === this.textAlign.right) {
			return this.terminalInvisibleSymbol + this.invisibleSymbol.repeat(invisibleSymbolsCount) + text;
		} else if (textAlign === this.textAlign.center) {
			const isEven = invisibleSymbolsCount % 2 === 0;
			const rightPart = this.invisibleSymbol.repeat(Math.trunc(invisibleSymbolsCount / 2));
			const leftPart = rightPart + (isEven ? "" : this.invisibleSymbol);
			return this.terminalInvisibleSymbol + leftPart + text + rightPart + this.terminalInvisibleSymbol;
		} else {
			return text;
		}
	}
}

module.exports = new TextResizingService();

