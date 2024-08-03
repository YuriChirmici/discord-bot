const { createCanvas } = require("canvas");

class TextResizingService {
	constructor() {
		// eslint-disable-next-line no-unused-vars
		const invisibleSymbols = "       ㅤ";

		this.invisibleLastSymbol = "ㅤ";
		this.customFontName = "gg sans";
		this._initContext();
	}

	_initContext() {
		const fontSize = 12;
		const fontWeight = 500;
		this.canvas = createCanvas(800, 200);
		const context = this.canvas.getContext("2d");
		context.font = `${fontWeight} ${fontSize}px ${this.customFontName}`;
		this.context = context;
	};

	_getInvisibleRow(size) {
		const invisibleSymbol = " ";
		const invisibleSymbolSize = this.getTextWidth(invisibleSymbol);
		let resultText = "";
		while (this.getTextWidth(resultText += invisibleSymbol) < size) {}

		const resultTextSize = this.getTextWidth(resultText);
		if ((resultTextSize - invisibleSymbolSize / 2) > size) {
			resultText = resultText.substring(0, resultText.length - 1);
		}

		return resultText;
	};

	getTextWidth(text) {
		return this.context.measureText(text).width;
	}

	resizeText(text, targetSize) {
		const lastSymbolActualSize = 12;
		const textSize = this.getTextWidth(text);

		const invisibleRowSize = targetSize - textSize - lastSymbolActualSize;
		if (invisibleRowSize <= 0) {
			return text;
		}

		const invisibleRow = this._getInvisibleRow(invisibleRowSize);
		const resultText = text + invisibleRow + this.invisibleLastSymbol;

		return resultText;
	};
}

module.exports = new TextResizingService();

