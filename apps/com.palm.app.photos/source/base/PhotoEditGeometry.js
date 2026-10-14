/*
 * webOS CE: the photo editor's geometry, kept free of the DOM so it can be tested.
 *
 * A picture is drawn through a 2x2 matrix M (entries 0/+1/-1) that maps source pixels,
 * centred, to displayed pixels, centred. M = R^turns * E, where E undoes the file's
 * EXIF orientation and R is one quarter turn clockwise.
 *
 * The crop is kept as fractions {x, y, w, h} of the DISPLAYED picture, so it survives
 * scaling between the on-screen preview and the full-size render, and rotates with the
 * picture.
 */
var PhotoEditGeometry = {
	// EXIF orientation -> the matrix that displays the stored pixels upright
	EXIF: {
		1: [1, 0, 0, 1],
		2: [-1, 0, 0, 1],
		3: [-1, 0, 0, -1],
		4: [1, 0, 0, -1],
		5: [0, 1, 1, 0],
		6: [0, -1, 1, 0],
		7: [0, -1, -1, 0],
		8: [0, 1, -1, 0]
	},
	// [a, b, c, d] is the matrix [[a, b], [c, d]]: x' = a*x + b*y, y' = c*x + d*y
	multiply: function (p, q) {
		return [p[0] * q[0] + p[1] * q[2], p[0] * q[1] + p[1] * q[3],
			p[2] * q[0] + p[3] * q[2], p[2] * q[1] + p[3] * q[3]];
	},
	matrix: function (exifOrientation, turns) {
		var m = this.EXIF[exifOrientation] || this.EXIF[1];
		var cw = [0, -1, 1, 0];
		for (var i = 0; i < ((turns % 4) + 4) % 4; i++) { m = this.multiply(cw, m); }
		return m;
	},
	/** The displayed size of a w x h source drawn through m. */
	displaySize: function (m, w, h) {
		return m[0] !== 0 ? {width: w, height: h} : {width: h, height: w};
	},
	/**
	 * The canvas setTransform(a, b, c, d, e, f) arguments that draw a w x h source
	 * through m at `scale`, with the displayed pixel (offsetX, offsetY) at the canvas
	 * origin -- i.e. the crop's top-left corner, in scaled display pixels.
	 */
	canvasTransform: function (m, w, h, scale, offsetX, offsetY) {
		var d = this.displaySize(m, w, h);
		var a = m[0] * scale, c = m[1] * scale, b = m[2] * scale, dd = m[3] * scale;
		var e = d.width * scale / 2 - offsetX - (a * w / 2 + c * h / 2);
		var f = d.height * scale / 2 - offsetY - (b * w / 2 + dd * h / 2);
		return [a, b, c, dd, e, f];
	},
	/** The crop after the picture turns a quarter clockwise (dir 1) or anticlockwise (-1). */
	rotateCrop: function (r, dir) {
		return dir > 0 ? {x: 1 - r.y - r.h, y: r.x, w: r.h, h: r.w}
			: {x: r.y, y: 1 - r.x - r.w, w: r.h, h: r.w};
	},
	/**
	 * The largest crop of `ratio` (width/height in pixels, of a picture shown pw x ph)
	 * centred where `r` is centred, inside the picture.
	 */
	fitRatio: function (r, ratio, pw, ph) {
		var w = pw, h = pw / ratio;
		if (h > ph) { h = ph; w = ph * ratio; }
		var fw = w / pw, fh = h / ph;
		var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
		return {
			x: Math.min(Math.max(cx - fw / 2, 0), 1 - fw),
			y: Math.min(Math.max(cy - fh / 2, 0), 1 - fh),
			w: fw, h: fh
		};
	},
	isFull: function (r) {
		var e = 0.001;
		return r.x < e && r.y < e && r.w > 1 - e && r.h > 1 - e;
	},
	/**
	 * The crop after dragging `handle` ("tl" "t" "tr" "r" "br" "b" "bl" "l", or "move")
	 * from `start` by (dx, dy) screen pixels, on a picture shown pw x ph. Keeps `ratio`
	 * (pixel width/height) when given, and every edge at least minPx from its opposite.
	 */
	dragCrop: function (start, handle, dx, dy, pw, ph, ratio, minPx) {
		var fx = dx / pw, fy = dy / ph;
		var minW = Math.min(1, minPx / pw), minH = Math.min(1, minPx / ph);
		var L = start.x, T = start.y, R = start.x + start.w, B = start.y + start.h;
		if (handle === "move") {
			var nx = Math.min(Math.max(L + fx, 0), 1 - start.w);
			var ny = Math.min(Math.max(T + fy, 0), 1 - start.h);
			return {x: nx, y: ny, w: start.w, h: start.h};
		}
		var left = handle.indexOf("l") !== -1, right = handle.indexOf("r") !== -1;
		var top = handle.indexOf("t") !== -1, bottom = handle.indexOf("b") !== -1;
		if (left) { L = Math.min(Math.max(L + fx, 0), R - minW); }
		if (right) { R = Math.max(Math.min(R + fx, 1), L + minW); }
		if (top) { T = Math.min(Math.max(T + fy, 0), B - minH); }
		if (bottom) { B = Math.max(Math.min(B + fy, 1), T + minH); }
		if (ratio) {
			// pixel sizes, then pick the dimension the drag drives and derive the other
			var w = (R - L) * pw, h = (B - T) * ph;
			var horizontal = (left || right) && !(top || bottom);
			var vertical = (top || bottom) && !(left || right);
			if (horizontal) { h = w / ratio; }
			else if (vertical) { w = h * ratio; }
			else if (w / h > ratio) { w = h * ratio; } else { h = w / ratio; }
			// the room available from the anchored side
			var maxW = (left ? R : 1 - L) * pw, maxH = (top ? B : 1 - T) * ph;
			if (horizontal || vertical) {
				// edge handles grow about the centre of the other axis
				if (horizontal) {
					var cy = (start.y + start.h / 2) * ph;
					maxH = 2 * Math.min(cy, ph - cy);
				} else {
					var cx = (start.x + start.w / 2) * pw;
					maxW = 2 * Math.min(cx, pw - cx);
				}
			}
			if (w > maxW) { w = maxW; h = w / ratio; }
			if (h > maxH) { h = maxH; w = h * ratio; }
			var fw = w / pw, fh = h / ph;
			if (horizontal) {
				var midY = start.y + start.h / 2;
				T = midY - fh / 2; B = midY + fh / 2;
				if (left) { L = R - fw; } else { R = L + fw; }
			} else if (vertical) {
				var midX = start.x + start.w / 2;
				L = midX - fw / 2; R = midX + fw / 2;
				if (top) { T = B - fh; } else { B = T + fh; }
			} else {
				if (left) { L = R - fw; } else { R = L + fw; }
				if (top) { T = B - fh; } else { B = T + fh; }
			}
		}
		return {x: L, y: T, w: R - L, h: B - T};
	}
};

if (typeof module !== "undefined") { module.exports = PhotoEditGeometry; }
