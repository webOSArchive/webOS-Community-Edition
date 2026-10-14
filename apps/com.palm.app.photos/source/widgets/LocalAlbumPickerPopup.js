enyo.kind({
    name: 'LocalAlbumPickerPopup',
    kind: 'AlbumPickerPopup',
    dbQuery: function(inSender, inQuery) {
        var extQuery = enyo.clone(inQuery);
        extQuery.where = extQuery.where ? extQuery.where : [];
        extQuery.where.push({ prop: "showAlbum", op: "=", val: true });
        extQuery.where.push({ prop: "type", op: "=", val: "local" });
        return this.$.db.call({query: extQuery});
    }
});

