/*
 * webOS CE: the little EXIF the photo editor needs, on "binary strings" (one byte per
 * char) -- this WebKit has no typed arrays or FileReader, but atob/btoa and an
 * x-user-defined XHR both speak binary strings.
 *
 * The editor reads the source picture's Orientation (WebKit ignores it, but the
 * thumbnailer honours it, so the editor must too) and its dates (the media indexer
 * takes a photo's createdTime from them; a canvas-encoded JPEG has no EXIF at all, so
 * without them an edited photo would sort as 1970). It writes back a minimal APP1 with
 * those dates and Orientation 1, because the pixels are already upright.
 */
var JpegExif = {
	TAG_ORIENTATION: 0x0112,
	TAG_DATETIME: 0x0132,
	TAG_EXIF_IFD: 0x8769,
	TAG_DATETIME_ORIGINAL: 0x9003,

	/** {orientation, dateTime, dateTimeOriginal} from a JPEG; orientation 1 if none. */
	read: function (bin) {
		var out = {orientation: 1};
		if (!bin || bin.charCodeAt(0) !== 0xFF || bin.charCodeAt(1) !== 0xD8) { return out; }
		var p = 2;
		while (p + 4 <= bin.length && bin.charCodeAt(p) === 0xFF) {
			var marker = bin.charCodeAt(p + 1);
			if (marker === 0xDA || marker === 0xD9) { break; }  // image data starts: no more headers
			var len = (bin.charCodeAt(p + 2) << 8) | bin.charCodeAt(p + 3);
			if (marker === 0xE1 && bin.substr(p + 4, 6) === "Exif\0\0") {
				this._readTiff(bin, p + 10, p + 2 + len, out);
				break;
			}
			p += 2 + len;
		}
		return out;
	},
	_readTiff: function (bin, t, end, out) {
		var le = bin.substr(t, 2) === "II";
		var u16 = function (o) {
			var a = bin.charCodeAt(t + o), b = bin.charCodeAt(t + o + 1);
			return le ? (b << 8) | a : (a << 8) | b;
		};
		var u32 = function (o) {
			return le ? (u16(o + 2) * 65536 + u16(o)) : (u16(o) * 65536 + u16(o + 2));
		};
		var ascii = function (entry) {
			var count = u32(entry + 4), at = count > 4 ? u32(entry + 8) : entry + 8;
			if (t + at + count > end) { return undefined; }
			return bin.substr(t + at, count).replace(/\0+$/, "");
		};
		var ifd = function (o, visit) {
			if (o <= 0 || t + o + 2 > end) { return; }
			var n = u16(o);
			for (var i = 0; i < n; i++) {
				var e = o + 2 + i * 12;
				if (t + e + 12 > end) { return; }
				visit(u16(e), e);
			}
		};
		var exifIfd = 0;
		ifd(u32(4), function (tag, e) {
			if (tag === JpegExif.TAG_ORIENTATION) {
				var v = u16(e + 8);
				if (v >= 1 && v <= 8) { out.orientation = v; }
			} else if (tag === JpegExif.TAG_DATETIME) {
				out.dateTime = ascii(e);
			} else if (tag === JpegExif.TAG_EXIF_IFD) {
				exifIfd = u32(e + 8);
			}
		});
		ifd(exifIfd, function (tag, e) {
			if (tag === JpegExif.TAG_DATETIME_ORIGINAL) { out.dateTimeOriginal = ascii(e); }
		});
	},

	/** A complete APP1 segment (marker included): Orientation 1 plus the given dates. */
	build: function (info) {
		var be16 = function (v) { return String.fromCharCode((v >> 8) & 0xFF, v & 0xFF); };
		var be32 = function (v) { return be16(Math.floor(v / 65536)) + be16(v % 65536); };
		var date = function (s) {
			// "YYYY:MM:DD HH:MM:SS" is 19 chars + NUL = the 20 the spec requires
			return (typeof s === "string" && s.length === 19) ? s + "\0" : null;
		};
		var dt = date(info && info.dateTime), dto = date(info && info.dateTimeOriginal);
		// IFD0: Orientation [, DateTime] [, ExifIFD]; then the Exif IFD; then the strings
		var n0 = 1 + (dt ? 1 : 0) + (dto ? 1 : 0);
		var ifd0 = 8, ifd0Size = 2 + n0 * 12 + 4;
		var exif = ifd0 + ifd0Size, exifSize = dto ? 2 + 12 + 4 : 0;
		var data = exif + exifSize;
		var entry = function (tag, type, count, value) { return be16(tag) + be16(type) + be32(count) + value; };
		var t = "MM\0*" + be32(ifd0) + be16(n0);
		t += entry(this.TAG_ORIENTATION, 3, 1, be16(1) + "\0\0");
		var strings = "";
		if (dt) { t += entry(this.TAG_DATETIME, 2, 20, be32(data)); strings += dt; }
		if (dto) { t += entry(this.TAG_EXIF_IFD, 4, 1, be32(exif)); }
		t += be32(0);  // no IFD1 (no embedded thumbnail: it would show the unedited picture)
		if (dto) {
			t += be16(1) + entry(this.TAG_DATETIME_ORIGINAL, 2, 20, be32(data + strings.length)) + be32(0);
			strings += dto;
		}
		t += strings;
		var payload = "Exif\0\0" + t;
		return "\xFF\xE1" + be16(payload.length + 2) + payload;
	},

	/** The JPEG with `app1` inserted after SOI and any JFIF APP0, as EXIF readers expect. */
	insert: function (jpeg, app1) {
		var p = 2;
		if (jpeg.charCodeAt(2) === 0xFF && jpeg.charCodeAt(3) === 0xE0) {
			p = 4 + ((jpeg.charCodeAt(4) << 8) | jpeg.charCodeAt(5));
		}
		return jpeg.substr(0, p) + app1 + jpeg.substr(p);
	}
};

if (typeof module !== "undefined") { module.exports = JpegExif; }
