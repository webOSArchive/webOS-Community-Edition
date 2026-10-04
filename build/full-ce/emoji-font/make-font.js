// Builds CE-Emoji.ttf: the BMP emoji (every U+0080..U+FFFF code point with the
// Unicode Emoji property, 170 at Unicode 15/16) from Noto Emoji, pinned to a
// static Regular instance (the device's 2010 FreeType cannot read variable
// fonts), plus zero-width glyphs for FE0F/FE0E/200D so emoji presentation
// selectors stop drawing as boxes. See Docs/EMOJI-FONT.md.
//
//   npm i subset-font && node make-font.js
//
// The output is committed; bake.py only verifies it, so the bake stays offline.
const subset = require('subset-font');
const fs = require('fs');
const path = require('path');

const cps = [];
for (let u = 0x80; u <= 0xFFFF; u++) {
    if (u >= 0xD800 && u <= 0xDFFF) continue;
    if (/\p{Emoji}/u.test(String.fromCharCode(u))) cps.push(u);
}
const text = cps.map(u => String.fromCharCode(u)).join('') + '️︎‍';
const src = fs.readFileSync(path.join(__dirname, 'NotoEmoji[wght].ttf'));
subset(src, text, {targetFormat: 'truetype', variationAxes: {wght: 400}}).then(buf => {
    fs.writeFileSync(path.join(__dirname, 'CE-Emoji.ttf'), buf);
    fs.writeFileSync(path.join(__dirname, 'codepoints.txt'),
        cps.map(u => u.toString(16).toUpperCase().padStart(4, '0')).join('\n') + '\n');
    console.log(`CE-Emoji.ttf: ${buf.length} bytes, ${cps.length} emoji`);
});
