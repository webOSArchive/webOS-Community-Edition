//testing depends.js

enyo.depends
(	'../../../'
,	'libs/DataHubSpec.js'
,	'app/shared/EventViewSpec.js'
,	'app/shared/LayoutManagerSpec.js'
,	'app/AppIconSpec.js'	// Added underscore so it isn't included with Jenkins testing.
)