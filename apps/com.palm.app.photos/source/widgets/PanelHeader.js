// Implements the Content Panel Header design component 
// as specified by PunchCut in MSM_Implementation_Guide_1182010.pdf

enyo.kind({
	name: "PanelHeader",
	kind: enyo.Control,
	className: "PanelHeader",
	events: {
		onClickLabel: ''
	},
	published: {
		label: '',
		iconStyle: '',
		labelStyle: '',
		controlAreaStyle: '',
	},
	chrome: [
		{kind: 'HFlexBox', /* className:"enyo-text-ellipsis",style: '-webkit-box-align: center !important; border:1px solid re',*/ flex: 1, pack: 'center', components: [
//			{ flex: 1 },
//			{ name: 'icon', height: '40px', width: '40px' },
			{ name: 'icon'},			
			{ name: 'label', onclick: 'doClickLabel', style:'max-width:80%'},
			// Place to plugin in controls specific to this header
//			{ flex: 1 },
			{ name: 'client', style: 'position: absolute; height: 100%; top: 0; right: 0;'  }
		]}
	],
	create: function() {
		this.inherited(arguments);
		this.labelChanged();
		this.labelStyleChanged();
		this.iconStyleChanged();
		this.controlAreaStyleChanged();
	},
	labelChanged: function() {
		this.$.label.setContent(this.label || "");
		this.$.label.setClassName('enyo-text-ellipsis');
	},
	iconStyleChanged: function() {
		this.$.icon.setClassName('library-navigation-icon-20x20 ' + this.iconStyle);
	},
	labelStyleChanged: function(oldStyle) {
		if (oldStyle === this.labelStyle) return;
		this.$.label.setClassName(this.labelStyle);
	},
	controlAreaStyleChanged: function(oldStyle) {
		if (oldStyle === this.controlAreaStyle) return;
		this.$.client.setClassName(this.controlAreaStyle);
	}
});


