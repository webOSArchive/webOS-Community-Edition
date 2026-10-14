/**
 Usage - declaring a MessageDialog instance and passing your message string to the message property:
     { name: "myDialog", kind: "MessageDialog", message: $L("I'm hungry.") }

 To open the dialog box declared above, call the following from inside your component.
     this.$.myDialog.openAtCenter();

 Optionally to specify the width or the height...
     { name: "myDialog", kind: "MessageDialog", width: "400px", height: "200px",
       message: $L("I'm very fat.") }

 To be notified about the dialog box open and close...
     { name: "myDialog", kind: "MessageDialog", width: "400px", height: "200px",
       message: $L("I'm very fat."),
       onOpen: "dialogOpenHandler", onClose: "dialogCloseHandler" }
     ...
     dialogOpenHandler: function (inSender) {
         // do stuff here, after the dialog box has been opened
     },
     dialogHandler: function (inSender) {
         // do stuff here, after the dialog box has been closed
     }

 To change the message after the MessageDialog instance has been instantiaged...
     this.$.myDialog.setMessage($L("modified new message."));
 */
enyo.kind({
    name: "MessageDialog",
    kind: enyo.Control,
    events: {
        onOpen: "",
        onClose: ""
    },
    width: "300px",   // default width
    height: "auto",   // default height
    components: [
        { name: "box", kind: enyo.Popup, lazy: false, showHideMode: "transition", openClassName: "enyo-msgBox-animEnd",
          className: "enyo-msgBox-animStart", layoutKind: "VFlexLayout",
          onOpen: "onOpenHandler", onClose: "onCloseHandler",
          components: [
              { name: "msgArea", content: " ", className: "enyo-msgBox-msgArea" },
              { kind: "HFlexBox", className: "enyo-msgBox-btnArea",
                components: [
                    { name: "paddingLeft", flex: 1 },
                    { kind: "Button", caption: $L("OK"), onclick: "closeDialog" },
                    { name: "paddingRight", flex: 1 }
                ]
              }
          ]
       }
    ],
    create: function (cfg) {
        this.inherited(arguments);
        var dimArr = [], dimStyle = null;
        if (this.width || this.height) {
            if (this.width)  { dimArr.push("width:"+this.width); }
            if (this.height) { dimArr.push("height:"+this.height); }
            dimStyle = dimArr.join(";")+";";
            this.$.box.addStyles(dimStyle);
        }
        this.message && this.setMessage(this.message);
    },
    setMessage: function (text) {
        this.$.msgArea.setContent(text);
    },
    openAtCenter: function () {
        this.$.box.openAtCenter();
    },
    closeDialog: function (inSender, ev) {
        this.$.box.close();
    },
    onOpenHandler: function (inSender, ev) {
        this.doOpen();
    },
    onCloseHandler: function (inSender, ev) {
        this.doClose();
    }
});
