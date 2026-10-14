/*
 * webOS CE: rotate and crop for a photo on the device.
 *
 * Opened over PictureMode by its Edit button. The picture is shown upright (its EXIF
 * orientation applied, as the thumbnails are) with a crop frame over it; the toolbar
 * turns it a quarter at a time and picks the crop shape. Save renders the result at
 * full size in a canvas and hands the bytes to org.webosarchive.photos.service, which
 * writes them either as a copy beside the original or over it.
 *
 * Writing a picture makes the media indexer drop its db8 record and index the file
 * afresh (a new _id, new thumbnails) -- so after saving, the editor waits for the new
 * record and hands its id back to PictureMode to show.
 */
enyo.kind({
	name: 'PhotoEditor',
	kind: enyo.Control,
	className: 'PhotoEditor',
	events: {
		// inResult: {path, pictureId} after a save, or nothing for Cancel
		onClose: ''
	},
	// Canvas memory on the TouchPad: a 4000x3000 render is ~2s and fine; beyond this
	// many pixels the result is scaled down to it rather than risk the WebAppMgr.
	maxPixels: 16000000,
	jpegQuality: 0.95,
	chunkChars: 262144,  // base64 per service call (a multiple of 4)
	stageMargin: 24,
	minCropPx: 48,
	components: [
		{ name: 'stage', className: 'PhotoEditorStage', components: [
			{ name: 'preview', nodeTag: 'canvas', className: 'PhotoEditorCanvas' },
			{ name: 'shadeTop', className: 'PhotoEditorShade' },
			{ name: 'shadeBottom', className: 'PhotoEditorShade' },
			{ name: 'shadeLeft', className: 'PhotoEditorShade' },
			{ name: 'shadeRight', className: 'PhotoEditorShade' },
			{ name: 'frame', className: 'PhotoEditorFrame', handle: 'move',
				ondragstart: 'cropDragStart', ondrag: 'cropDrag', ondragfinish: 'cropDragFinish', components: [
				{ className: 'PhotoEditorThird v1' }, { className: 'PhotoEditorThird v2' },
				{ className: 'PhotoEditorThird h1' }, { className: 'PhotoEditorThird h2' },
				{ className: 'PhotoEditorHandle tl', handle: 'tl', ondragstart: 'cropDragStart', ondrag: 'cropDrag', ondragfinish: 'cropDragFinish' },
				{ className: 'PhotoEditorHandle tr', handle: 'tr', ondragstart: 'cropDragStart', ondrag: 'cropDrag', ondragfinish: 'cropDragFinish' },
				{ className: 'PhotoEditorHandle bl', handle: 'bl', ondragstart: 'cropDragStart', ondrag: 'cropDrag', ondragfinish: 'cropDragFinish' },
				{ className: 'PhotoEditorHandle br', handle: 'br', ondragstart: 'cropDragStart', ondrag: 'cropDrag', ondragfinish: 'cropDragFinish' },
				{ className: 'PhotoEditorEdge t', handle: 't', ondragstart: 'cropDragStart', ondrag: 'cropDrag', ondragfinish: 'cropDragFinish' },
				{ className: 'PhotoEditorEdge b', handle: 'b', ondragstart: 'cropDragStart', ondrag: 'cropDrag', ondragfinish: 'cropDragFinish' },
				{ className: 'PhotoEditorEdge l', handle: 'l', ondragstart: 'cropDragStart', ondrag: 'cropDrag', ondragfinish: 'cropDragFinish' },
				{ className: 'PhotoEditorEdge r', handle: 'r', ondragstart: 'cropDragStart', ondrag: 'cropDrag', ondragfinish: 'cropDragFinish' }
			]},
			{ name: 'busy', className: 'PhotoEditorBusy', showing: false, components: [
				{ name: 'spinner', kind: 'SpinnerLarge' },
				{ name: 'busyText', className: 'PhotoEditorBusyText' }
			]}
		]},
		{ name: 'toolbar', kind: 'HFlexBox', className: 'PictureModeTopControls PhotoEditorToolbar', components: [
			{ name: 'cancelButton', kind: 'Button', className: 'enyo-button-dark PhotoEditorTextButton',
				caption: $L('Cancel'), onclick: 'cancelClick' },
			{ flex: 1 },
			{ name: 'rotateLeftButton', kind: 'ToolButton', icon: 'images/icn-rotate-left.png',
				className: 'image-view-button', onclick: 'rotateLeft' },
			{ name: 'rotateRightButton', kind: 'ToolButton', icon: 'images/icn-rotate-right.png',
				className: 'image-view-button', onclick: 'rotateRight' },
			{ name: 'cropButton', kind: 'ToolButton', icon: 'images/icn-crop.png',
				className: 'image-view-button', onclick: 'openCropMenu' },
			{ flex: 1 },
			{ name: 'saveButton', kind: 'Button', className: 'enyo-button-dark PhotoEditorTextButton',
				caption: $L('Save'), disabled: true, onclick: 'saveClick' }
		]},
		{ name: 'cropMenu', kind: 'PopupSelect', onSelect: 'cropMenuSelect' },
		{ name: 'saveDialog', kind: 'ModalDialog', caption: $L('Save Changes'), components: [
			{ name: 'saveDialogText', className: 'PhotoEditorDialogText' },
			{ kind: 'Button', caption: $L('Save as Copy'), onclick: 'saveCopy' },
			{ name: 'replaceButton', kind: 'Button', className: 'enyo-button-negative',
				caption: $L('Replace Original'), onclick: 'saveReplace' },
			{ kind: 'Button', caption: $L('Cancel'), onclick: 'closeSaveDialog' }
		]},
		{ name: 'msgDialog', kind: 'MessageDialog' },
		{ kind: 'PalmService', service: 'palm://org.webosarchive.photos.service/', onFailure: 'writeFailed', components: [
			{ name: 'writeChunk', method: 'writeChunk', onSuccess: 'chunkWritten' },
			{ name: 'commit', method: 'commit', onSuccess: 'committed' },
			{ name: 'discard', method: 'discard' }
		]},
		{ name: 'findSaved', kind: 'DbService', dbKind: 'com.palm.media.image.file:1', method: 'find',
			onSuccess: 'findSavedResponse', onFailure: 'findSavedResponse' }
	],
	// the crop shapes, in the menu's order; ratio is width/height, "original" the picture's
	cropShapes: [
		{ value: 'free', caption: $L('Freeform') },
		{ value: 'original', caption: $L('Original Proportions') },
		{ value: 'square', caption: $L('Square'), ratio: 1 },
		{ value: '4:3', caption: $L('4 x 3'), ratio: 4 / 3 },
		{ value: '3:2', caption: $L('3 x 2'), ratio: 3 / 2 },
		{ value: '16:9', caption: $L('16 x 9'), ratio: 16 / 9 },
		{ value: 'revert', caption: $L('Undo All Changes') }
	],
	create: function () {
		this.inherited(arguments);
		this.setShowing(false);
	},

	// ---------- Opening and closing -------------------------------------------------

	/** Whether a picture's file is one this editor can save. */
	canEdit: function (dbEntry) {
		return !!(dbEntry && dbEntry.mediaType === 'image' && !dbEntry.accountId &&
			typeof dbEntry.path === 'string' && dbEntry.path.indexOf('/media/internal/') === 0 &&
			dbEntry.path.indexOf('/.') === -1 && /\.(jpe?g|png)$/i.test(dbEntry.path));
	},
	openEditor: function (dbEntry) {
		this.dbEntry = dbEntry;
		this.isPng = /\.png$/i.test(dbEntry.path);
		this.image = null;
		this.exif = null;
		this.turns = 0;
		this.crop = { x: 0, y: 0, w: 1, h: 1 };
		this.shape = 'free';
		this.saving = false;
		this.setShowing(true);
		this.$.frame.hide();
		this.showBusy($L('Loading...'));
		this.updateButtons();

		var self = this, pending = this.isPng ? 1 : 2;
		var ready = function () {
			if (--pending === 0 && self.dbEntry === dbEntry) { self.loaded(); }
		};
		var img = new Image();
		img.onload = function () { self.image = img; ready(); };
		img.onerror = function () { self.loadFailed(); };
		img.src = dbEntry.path;
		if (!this.isPng) {
			// WebKit draws the stored pixels and ignores EXIF orientation; read it ourselves.
			this.readExif(dbEntry.path, function (info) { self.exif = info; ready(); });
		}
	},
	readExif: function (path, callback) {
		var xhr = new XMLHttpRequest(), done = false;
		var finish = function (info) { if (!done) { done = true; callback(info); } };
		try {
			xhr.open('GET', path, true);
			xhr.overrideMimeType('text/plain; charset=x-user-defined');
			xhr.onreadystatechange = function () {
				if (xhr.readyState !== 4) { return; }
				var info = { orientation: 1 };
				try {
					var text = xhr.responseText || '', bin = '';
					// only the headers matter; EXIF must sit in the first 64KB
					var n = Math.min(text.length, 65536 + 1024);
					for (var i = 0; i < n; i++) { bin += String.fromCharCode(text.charCodeAt(i) & 0xFF); }
					info = JpegExif.read(bin);
				} catch (e) {
					console.warn('PhotoEditor: could not read EXIF: ' + e);
				}
				finish(info);
			};
			xhr.send(null);
		} catch (e) {
			console.warn('PhotoEditor: could not read ' + path + ': ' + e);
			finish({ orientation: 1 });
		}
	},
	loaded: function () {
		this.hideBusy();
		this.$.frame.show();
		this.layoutPicture();
		this.updateButtons();
	},
	loadFailed: function () {
		this.hideBusy();
		this.showMessage($L('This photo could not be opened for editing.'));
		this.closeEditor();
	},
	closeEditor: function (inResult) {
		this.dbEntry = null;
		this.image = null;
		this.setShowing(false);
		this.doClose(inResult);
	},
	cancelClick: function () {
		if (!this.saving) { this.closeEditor(); }
	},

	// ---------- Layout ----------------------------------------------------------------

	matrix: function () {
		return PhotoEditGeometry.matrix(this.exif ? this.exif.orientation : 1, this.turns);
	},
	/** The picture's size as displayed, in its own pixels. */
	displaySize: function () {
		return PhotoEditGeometry.displaySize(this.matrix(), this.image.width, this.image.height);
	},
	resize: function () {
		if (this.showing && this.image) { this.layoutPicture(); }
	},
	layoutPicture: function () {
		var stage = this.$.stage.hasNode(), canvas = this.$.preview.hasNode();
		if (!stage || !canvas || !this.image) { return; }
		var d = this.displaySize(), m = this.stageMargin;
		var availW = Math.max(stage.offsetWidth - 2 * m, 1), availH = Math.max(stage.offsetHeight - 2 * m, 1);
		var scale = Math.min(availW / d.width, availH / d.height, 4);
		var w = Math.max(Math.round(d.width * scale), 1), h = Math.max(Math.round(d.height * scale), 1);
		this.box = {
			left: Math.round((stage.offsetWidth - w) / 2),
			top: Math.round((stage.offsetHeight - h) / 2),
			width: w, height: h
		};
		canvas.width = w;
		canvas.height = h;
		canvas.style.left = this.box.left + 'px';
		canvas.style.top = this.box.top + 'px';
		var ctx = canvas.getContext('2d');
		var t = PhotoEditGeometry.canvasTransform(this.matrix(), this.image.width, this.image.height, w / d.width, 0, 0);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, w, h);
		ctx.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]);
		ctx.drawImage(this.image, 0, 0);
		this.layoutCrop();
	},
	layoutCrop: function () {
		var v = this.box, c = this.crop;
		if (!v) { return; }
		var x = v.left + Math.round(c.x * v.width), y = v.top + Math.round(c.y * v.height);
		var r = v.left + Math.round((c.x + c.w) * v.width), b = v.top + Math.round((c.y + c.h) * v.height);
		var box = function (ctl, left, top, width, height) {
			ctl.applyStyle('left', left + 'px');
			ctl.applyStyle('top', top + 'px');
			ctl.applyStyle('width', Math.max(width, 0) + 'px');
			ctl.applyStyle('height', Math.max(height, 0) + 'px');
		};
		box(this.$.frame, x, y, r - x, b - y);
		box(this.$.shadeTop, v.left, v.top, v.width, y - v.top);
		box(this.$.shadeBottom, v.left, b, v.width, v.top + v.height - b);
		box(this.$.shadeLeft, v.left, y, x - v.left, b - y);
		box(this.$.shadeRight, r, y, v.left + v.width - r, b - y);
	},

	// ---------- Editing ----------------------------------------------------------------

	isChanged: function () {
		return this.turns % 4 !== 0 || !PhotoEditGeometry.isFull(this.crop);
	},
	updateButtons: function () {
		var ready = !!this.image && !this.saving;
		this.$.rotateLeftButton.setDisabled(!ready);
		this.$.rotateRightButton.setDisabled(!ready);
		this.$.cropButton.setDisabled(!ready);
		this.$.saveButton.setDisabled(!ready || !this.isChanged());
		this.$.cancelButton.setDisabled(this.saving);
	},
	rotateLeft: function () { this.rotate(-1); },
	rotateRight: function () { this.rotate(1); },
	rotate: function (dir) {
		if (!this.image || this.saving) { return; }
		this.turns = (this.turns + dir + 4) % 4;
		this.crop = PhotoEditGeometry.rotateCrop(this.crop, dir);
		this.layoutPicture();
		this.updateButtons();
	},
	/** width/height in pixels for the chosen shape, oriented like the current crop. */
	shapeRatio: function () {
		var d = this.displaySize(), s = this.shapeInfo(this.shape);
		if (!s || s.value === 'free') { return null; }
		var r = s.value === 'original' ? d.width / d.height : s.ratio;
		var cropLandscape = this.crop.w * d.width >= this.crop.h * d.height;
		if ((r >= 1) !== cropLandscape && s.value !== 'original') { r = 1 / r; }
		return r;
	},
	shapeInfo: function (value) {
		for (var i = 0; i < this.cropShapes.length; i++) {
			if (this.cropShapes[i].value === value) { return this.cropShapes[i]; }
		}
		return null;
	},
	openCropMenu: function () {
		if (!this.image || this.saving) { return; }
		var items = [];
		for (var i = 0; i < this.cropShapes.length; i++) {
			var s = this.cropShapes[i];
			// the check mark shows the current shape; "Undo" is an action, not a shape
			items.push({ caption: s.caption, value: s.value, icon: s.value === this.shape ? 'images/checkmark-dark.png' : 'images/menu-blank.png' });
		}
		this.$.cropMenu.setItems(items);
		this.$.cropMenu.openAroundControl(this.$.cropButton);
	},
	cropMenuSelect: function (inSender, inSelected) {
		var value = inSelected.getValue ? inSelected.getValue() : inSelected.value;
		if (value === 'revert') {
			this.turns = 0;
			this.crop = { x: 0, y: 0, w: 1, h: 1 };
			this.shape = 'free';
			this.layoutPicture();
		} else {
			this.shape = value;
			var r = this.shapeRatio();
			if (r) {
				var d = this.displaySize();
				this.crop = PhotoEditGeometry.fitRatio(this.crop, r, d.width, d.height);
			}
			this.layoutCrop();
		}
		this.updateButtons();
	},
	cropDragStart: function (inSender, inEvent) {
		if (!this.box || this.saving) { return true; }
		this.dragHandle = inSender.handle;
		this.dragStartCrop = enyo.mixin({}, this.crop);
		// fixed for the whole drag, so the shape cannot flip between portrait and landscape
		this.dragRatio = this.shapeRatio();
		this.$.frame.addClass('dragging');
		return true;
	},
	cropDrag: function (inSender, inEvent) {
		if (!this.dragHandle) { return true; }
		this.crop = PhotoEditGeometry.dragCrop(this.dragStartCrop, this.dragHandle, inEvent.dx, inEvent.dy,
			this.box.width, this.box.height, this.dragRatio, this.minCropPx);
		this.layoutCrop();
		return true;
	},
	cropDragFinish: function () {
		this.dragHandle = null;
		this.$.frame.removeClass('dragging');
		this.updateButtons();
		return true;
	},

	// ---------- Saving -----------------------------------------------------------------

	saveClick: function () {
		if (!this.image || !this.isChanged() || this.saving) { return; }
		var out = this.outputSize();
		var text = out.scaled
			? enyo.macroize($L('The edited photo will be {$width} x {$height} pixels.'), out)
			: $L('Keep the original photo and save the edited one beside it, or replace the original?');
		this.$.saveDialog.validateComponents();
		this.$.saveDialogText.setContent(text);
		this.$.saveDialog.openAtCenter();
	},
	closeSaveDialog: function () {
		this.$.saveDialog.close();
	},
	saveCopy: function () {
		this.closeSaveDialog();
		if (!this.image || this.saving) { return; }
		var p = this.dbEntry.path, dot = p.lastIndexOf('.');
		this.save(p.slice(0, dot) + '-edited' + p.slice(dot), false);
	},
	saveReplace: function () {
		this.closeSaveDialog();
		if (!this.image || this.saving) { return; }
		this.save(this.dbEntry.path, true);
	},
	/** The crop at full size, and the size it renders at (scaled down past maxPixels). */
	outputSize: function () {
		var d = this.displaySize(), c = this.crop;
		var cx = Math.round(c.x * d.width), cy = Math.round(c.y * d.height);
		var cw = Math.max(Math.round(c.w * d.width), 1), ch = Math.max(Math.round(c.h * d.height), 1);
		var s = Math.min(1, Math.sqrt(this.maxPixels / (cw * ch)));
		return { x: cx, y: cy, cropWidth: cw, cropHeight: ch, scale: s,
			width: Math.max(Math.round(cw * s), 1), height: Math.max(Math.round(ch * s), 1), scaled: s < 1 };
	},
	save: function (path, replace) {
		this.saving = true;
		this.updateButtons();
		this.showBusy($L('Saving...'));
		// let the spinner paint before the canvas work blocks the page
		enyo.job('PhotoEditor.render', enyo.bind(this, 'renderEdited', path, replace), 100);
	},
	renderEdited: function (path, replace) {
		var data;
		try {
			var o = this.outputSize(), canvas = document.createElement('canvas');
			canvas.width = o.width;
			canvas.height = o.height;
			var ctx = canvas.getContext('2d');
			var t = PhotoEditGeometry.canvasTransform(this.matrix(), this.image.width, this.image.height,
				o.scale, o.x * o.scale, o.y * o.scale);
			ctx.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]);
			ctx.drawImage(this.image, 0, 0);
			var type = this.isPng ? 'image/png' : 'image/jpeg';
			var url = this.isPng ? canvas.toDataURL(type) : canvas.toDataURL(type, this.jpegQuality);
			canvas.width = canvas.height = 1;  // free the pixels now
			var prefix = 'data:' + type + ';base64,';
			if (url.indexOf(prefix) !== 0) { throw new Error('canvas could not encode ' + type); }
			data = url.slice(prefix.length);
			if (!this.isPng) {
				// a canvas JPEG carries no EXIF: give it the original's dates, upright
				data = btoa(JpegExif.insert(atob(data), JpegExif.build(this.exif)));
			}
		} catch (e) {
			console.error('PhotoEditor: render failed: ' + e);
			this.saveFailed($L('The edited photo could not be created.'));
			return;
		}
		this.pending = { path: path, replace: replace, data: data, offset: 0 };
		this.sendChunk();
	},
	sendChunk: function () {
		var p = this.pending;
		var piece = p.data.substr(p.offset, this.chunkChars);
		this.$.writeChunk.call({ path: p.path, data: piece, append: p.offset > 0 });
		p.offset += piece.length;
	},
	chunkWritten: function () {
		var p = this.pending;
		if (!p) { return; }
		if (p.offset < p.data.length) {
			this.sendChunk();
		} else {
			this.$.commit.call({ path: p.path, replace: p.replace });
		}
	},
	committed: function (inSender, inResponse) {
		var p = this.pending;
		if (!p) { return; }
		p.data = null;
		p.savedPath = inResponse.path;
		p.tries = 0;
		console.log('PhotoEditor: saved ' + p.savedPath + ' (' + inResponse.size + ' bytes)');
		this.findSaved();
	},
	writeFailed: function (inSender, inResponse) {
		console.error('PhotoEditor: ' + JSON.stringify(inResponse));
		if (this.pending) { this.$.discard.call({ path: this.pending.path }); }
		this.saveFailed($L('The edited photo could not be saved.'));
	},
	saveFailed: function (message) {
		this.pending = null;
		this.saving = false;
		this.hideBusy();
		this.updateButtons();
		this.showMessage(message);
	},
	// The indexer gives the written file a new record within a few seconds, and the
	// Photos service then makes its thumbnails -- each step an update to the record that
	// resets the album's queries. Show the picture only once that has finished, or the
	// image view can miss it mid-reset.
	findSaved: function () {
		this.$.findSaved.call({ query: { where: [{ prop: 'path', op: '=', val: this.pending.savedPath }], limit: 1 } });
	},
	findSavedResponse: function (inSender, inResponse) {
		var p = this.pending;
		if (!p) { return; }
		var rec = inResponse && inResponse.results && inResponse.results[0];
		var fresh = rec && (!p.replace || rec._id !== this.dbEntry._id) &&
			rec.appCacheComplete && rec.appGridThumbnail && rec.appGridThumbnail.cached;
		if (fresh && !p.settled) {
			// one more second for the last record update to reach the album's queries
			p.settled = true;
			enyo.job('PhotoEditor.find', enyo.bind(this, 'findSaved'), 1000);
			return;
		}
		if (fresh || ++p.tries > 30) {
			this.pending = null;
			this.saving = false;
			this.hideBusy();
			if (!p.replace && window.PalmSystem) {
				enyo.windows.addBannerMessage($L('Saved a copy of the photo'), '{}');
			}
			this.closeEditor({ path: p.savedPath, pictureId: fresh ? rec._id : null });
			return;
		}
		enyo.job('PhotoEditor.find', enyo.bind(this, 'findSaved'), 1000);
	},

	// ---------- Feedback ---------------------------------------------------------------

	showBusy: function (text) {
		this.$.busyText.setContent(text);
		this.$.busy.show();
		this.$.spinner.show();
	},
	hideBusy: function () {
		this.$.spinner.hide();
		this.$.busy.hide();
	},
	showMessage: function (text) {
		this.$.msgDialog.setMessage(text);
		this.$.msgDialog.openAtCenter();
	}
});
