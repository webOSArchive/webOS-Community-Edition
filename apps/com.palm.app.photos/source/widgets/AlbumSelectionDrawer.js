/**
 *
 */

enyo.kind({
    name: "AlbumSelectionDrawer",
    kind: enyo.BasicDrawer,
    events: {
        onSelectionDone: ""
    },
    components: [
        { name: "albumsList", kind: "BasicScroller",
          horizontal: false,
          autoHorizontal: false,
          autoVertical: true,
          components: [
              { name: "panel" }
          ]
        },
        { name: "doneBtn", kind: "Button", className: "enyo-button-dark", style:"overflow:hidden",
          onclick: "onDoneClicked",
          components: [ 
              { name: "label", content: $L("Done") }
          ]
        }
    ],

    create: function() {
        this.inherited(arguments);
    
        this.resize();
    },

    /**
     * @param albums It is an array of elements each is an object of
     *               { albumId, title, photosCount, isSelected }
     */
    resetPanel: function (albums) {
        var el = this.$.panel.node;
        if (!el) {
            el = this.$.panel.hasNode();
            if (!el) { return; }
        }
        //while (el.firstChild) { el.removeChild(el.firstChild); }
        this.deleteAlbumsData();

        if (!albums) { return; }
        this.albums = this.cloneAlbumsArray(albums);
        var i, len = this.albums.length, rowEl;
        for (i = 0; i < len; i++) {
            this.albums[i].rowEl = rowEl = this.createRow(this.albums[i]);
            el.appendChild(rowEl);
        }
        this.resize();
    },

    cloneAlbumsArray: function (albumsArray) {
        if (!albumsArray) { return null; }
        var i, item, len = albumsArray.length, newArray = [];
        for (i = 0; i < len; i++) {
            item = albumsArray[i];
            newArray.push({
                albumId:     item.albumId.slice(0),
                title:       item.title.slice(0),
                photosCount: item.photosCount,
                isSelected:  item.isSelected,
                rowEl:       undefined
            });
        }

        return newArray;
    },

    createRow: function (albumItem) {
        var thisInst = this;
        var row = document.createElement("div");
        row.setAttribute("id", "album"+albumItem.albumId);
        row.setAttribute("class", "album-select-menu-item");
        row.asdInst = thisInst;
        row.addEventListener("click", thisInst.onMenuItemClickHandler, false);

        var chkBox = document.createElement("div");
        chkBox.setAttribute("id", "chkBox"+albumItem.albumId);
        this.setCheckBoxElement(chkBox, albumItem.isSelected);
        row.appendChild(chkBox);

        var label = document.createElement("div");
        label.setAttribute("class", "album-menu-label");
        label.innerHTML = albumItem.title;
        row.appendChild(label);

        return row;
    },

    destroyDomRow: function (domRow) {
        domRow.removeEventListener("click", this.onMenuItemClickHandler, false);
        while (domRow.firstChild) {
            domRow.removeChild(domRow.firstChild);
        }
        if (domRow.parentNode) { domRow.parentNode.removeChild(domRow); }
    },

    deleteAlbumsData: function () {
        if (!this.albums) { return; }
        var i, item, len = this.albums.length;
        for (i = 0; i < len; i++) {
            item = this.albums[i];
            if (item.rowEl) {
                this.destroyDomRow(item.rowEl);
                delete item.rowEl;
            }
        }
        delete this.albums;
    },

    setCheckBoxElement: function (el, isChecked) {
        var chkBoxClasses = isChecked ? "aCheckBox aChecked" : "aCheckBox aUnchecked";
        el.setAttribute("class", chkBoxClasses);
    },

    setAlbumCheckBox: function (rowEl, isChecked) {
        var node, nodes = rowEl.childNodes;
        var i, id, len = nodes.length;
        for (i = 0; i < len; i++) {
            node = nodes[i];
            id = node.id;
            if (!id) { continue; }
            if (!/^chkBox/.test(id)) { continue; }
            this.setCheckBoxElement(node, isChecked);
            break;
        }
    },

    resize: function (refEl) {
        var rowHeight = 38;   // assuming 38px height each row
        var maxH = refEl ? refEl.clientHeight : window.innerHeight;
        maxH = Math.floor(maxH*0.6);
        var numOfAlbums = this.albums ? this.albums.length : 0;
        var contentHeight = rowHeight*numOfAlbums;
        var h = contentHeight > maxH ? maxH : contentHeight;
        if (!this.node) { this.hasNode(); }
        this.$.albumsList.domStyles.height = h+"px";
        this.$.albumsList.domStylesChanged();
    },

    onMenuItemClickHandler: function (ev) {
        if (ev.stopPropagation) { ev.stopPropagation(); } else { ev.cancelBubble = true; }
        if (ev.preventDefault) { ev.preventDefault(); } else { ev.returnValue = false; }
        
        var rowEl = ev.currentTarget;
        var instInst = rowEl.asdInst;
        var id = rowEl.id;
        if (!id || 0 == id.length) { return; }
        var tokens = id.match(/album(\S+)/);
        if (!tokens || tokens.length < 2) { return; }
        var albumId = tokens[1];
        instInst.toggleAlbumSelection(albumId, rowEl);
    },

    toggleAlbumSelection: function (albumId, rowEl) {
        var albums = this.albums;
        if (!albums) { return; }
        var i, album, len = albums.length;
        for (i = 0; i < len; i++) {
            album = albums[i];
            if (album.albumId != albumId) { continue; }
            album.isSelected = album.isSelected ? false : true;
            this.setAlbumCheckBox(rowEl, album.isSelected);
            break;
        }
    },

    openChanged: function (oldValue) {
        this.inherited(arguments);
        if (undefined == this.open || this.open == true) { return; }

        // this drawer is closed
        if (this.isNoneSelected()) { this.selectAllAlbums(); }
    },

    selectAllAlbums: function () {
        var albums = this.albums;
        if (!albums) { return; }
        var i, album, len = albums.length;
        for (i = 0; i < len; i++) {
            album = albums[i];
            album.isSelected = true;
            this.setAlbumCheckBox(album.rowEl, album.isSelected);
        }
    },

    isNoneSelected: function () {
        var albums = this.albums;
        if (!albums) { return true; }
        var i, len = albums.length;
        for (i = 0; i < len; i++) {
            album = albums[i];
            if (album.isSelected) { return false; }
        }
        return true;
    },

    /**
     * It fires an onSelectionDone event.
     */
    onDoneClicked: function (inSender, ev) {
        if (ev.stopPropagation) { ev.stopPropagation(); } else { ev.cancelBubble = true; }
        if (ev.preventDefault) { ev.preventDefault(); } else { ev.returnValue = false; }

        this.doSelectionDone();
    },

    /**
     * @return It returns an array of albumId's that are selected.  An empty array means that no album
     *         is selected.
     */
    getSelectionState: function () {
        var albums = this.albums;
        var selectedAlbums = [];
        if (!albums) { return selectedAlbums; }
        var i, album, len = albums.length;
        for (i = 0; i < len; i++) {
            album = albums[i];
            if (!album.isSelected) { continue; }
            selectedAlbums.push(album.albumId.slice(0));
        }
        return selectedAlbums;
    },

    /**
     * Restores the albums selection to those listed in the ids array.
     *
     * @param ids - It is an array of zero or more albumIds to which to select albums.  An empty
     *              array would select all albums.
     */
    restoreAlbumsSelectionTo: function (ids) {
        var albums = this.albums;
        if (!albums) { return; }

        var i, album, len;
        if (!ids || 0 == ids.length) {
            // on empty ids, select all
            for (i = 0, len = albums.length; i < len; i++) {
                album = albums[i];
                album.isSelected = true;
                this.setAlbumCheckBox(album.rowEl, album.isSelected);
            }
            return;
        }

        // clears all selection
        for (i = 0, len = albums.length; i < len; i++) {
            album = albums[i];
            album.isSelected = false;
            this.setAlbumCheckBox(album.rowEl, album.isSelected);
        }

        // select those that are listed in the ids array
        var j, count;
        for (j = 0, count = ids.length; j < count; j++) {
            for (i = 0, len = albums.length; i < len; i++) {
                album = albums[i];
                if (album.albumId != ids[j]) { continue; }
                album.isSelected = true;
                this.setAlbumCheckBox(album.rowEl, album.isSelected);
                break;
            }
        }
    }
});
