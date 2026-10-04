function addCss(cssCode) {
	var styleElement = document.createElement("style");
  styleElement.type = "text/css";
  styleElement.appendChild(document.createTextNode(cssCode));
  document.getElementsByTagName("head")[0].appendChild(styleElement);
}

addCss("body { overflow: auto !important; }");

function getJson(filename) {
	return enyo.g11n.Utils.getJsonFile({path: 'spec/unit/source/mock', locale: filename});
}