this._root["__MojoFramework_calendar"] = function(MojoLoader, exports, root) {


//@ sourceURL=calendar/prologue.js

/* Copyright 2010 Palm, Inc.  All rights reserved. */

/*jslint laxbreak:true */
/*global MojoLoader */

var IMPORTS = (MojoLoader.require
(	{ name: "foundations"	, version: "1.0"}
,	{ name: "underscore"	, version: "1.0"}
));

var	_			= IMPORTS.underscore._
,	Foundations	= IMPORTS.foundations
,	Class		= Foundations.Class
,	DB			= Foundations.Data.DB
,	Future		= Foundations.Control.Future
,	ObjectUtils	= Foundations.ObjectUtils
,	PalmCall	= Foundations.Comms.PalmCall
,	Config		=
	{	//logs: "debug"		// used by utils.js to control logging
	}
;


//@ sourceURL=calendar/datejs/date.js

if (!Date.CultureInfo) {	// Only initialize DateJS if it doesn't already exist in the current scope.

/**
 * Version: 1.0 Alpha-1 
 * Build Date: 13-Nov-2007
 * Copyright (c) 2006-2007, Coolite Inc. (http://www.coolite.com/). All rights reserved.
 * License: Licensed under The MIT License. See license.txt and http://www.datejs.com/license/. 
 * Website: http://www.datejs.com/ or http://www.coolite.com/datejs/
 */
Date.CultureInfo={name:"en-US",englishName:"English (United States)",nativeName:"English (United States)",dayNames:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],abbreviatedDayNames:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],shortestDayNames:["Su","Mo","Tu","We","Th","Fr","Sa"],firstLetterDayNames:["S","M","T","W","T","F","S"],monthNames:["January","February","March","April","May","June","July","August","September","October","November","December"],abbreviatedMonthNames:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],amDesignator:"AM",pmDesignator:"PM",firstDayOfWeek:0,twoDigitYearMax:2029,dateElementOrder:"mdy",formatPatterns:{shortDate:"M/d/yyyy",longDate:"dddd, MMMM dd, yyyy",shortTime:"h:mm tt",longTime:"h:mm:ss tt",fullDateTime:"dddd, MMMM dd, yyyy h:mm:ss tt",sortableDateTime:"yyyy-MM-ddTHH:mm:ss",universalSortableDateTime:"yyyy-MM-dd HH:mm:ssZ",rfc1123:"ddd, dd MMM yyyy HH:mm:ss GMT",monthDay:"MMMM dd",yearMonth:"MMMM, yyyy"},regexPatterns:{jan:/^jan(uary)?/i,feb:/^feb(ruary)?/i,mar:/^mar(ch)?/i,apr:/^apr(il)?/i,may:/^may/i,jun:/^jun(e)?/i,jul:/^jul(y)?/i,aug:/^aug(ust)?/i,sep:/^sep(t(ember)?)?/i,oct:/^oct(ober)?/i,nov:/^nov(ember)?/i,dec:/^dec(ember)?/i,sun:/^su(n(day)?)?/i,mon:/^mo(n(day)?)?/i,tue:/^tu(e(s(day)?)?)?/i,wed:/^we(d(nesday)?)?/i,thu:/^th(u(r(s(day)?)?)?)?/i,fri:/^fr(i(day)?)?/i,sat:/^sa(t(urday)?)?/i,future:/^next/i,past:/^last|past|prev(ious)?/i,add:/^(\+|after|from)/i,subtract:/^(\-|before|ago)/i,yesterday:/^yesterday/i,today:/^t(oday)?/i,tomorrow:/^tomorrow/i,now:/^n(ow)?/i,millisecond:/^ms|milli(second)?s?/i,second:/^sec(ond)?s?/i,minute:/^min(ute)?s?/i,hour:/^h(ou)?rs?/i,week:/^w(ee)?k/i,month:/^m(o(nth)?s?)?/i,day:/^d(ays?)?/i,year:/^y((ea)?rs?)?/i,shortMeridian:/^(a|p)/i,longMeridian:/^(a\.?m?\.?|p\.?m?\.?)/i,timezone:/^((e(s|d)t|c(s|d)t|m(s|d)t|p(s|d)t)|((gmt)?\s*(\+|\-)\s*\d\d\d\d?)|gmt)/i,ordinalSuffix:/^\s*(st|nd|rd|th)/i,timeContext:/^\s*(\:|a|p)/i},abbreviatedTimeZoneStandard:{GMT:"-000",EST:"-0400",CST:"-0500",MST:"-0600",PST:"-0700"},abbreviatedTimeZoneDST:{GMT:"-000",EDT:"-0500",CDT:"-0600",MDT:"-0700",PDT:"-0800"}};
Date.getMonthNumberFromName=function(name){var n=Date.CultureInfo.monthNames,m=Date.CultureInfo.abbreviatedMonthNames,s=name.toLowerCase();for(var i=0;i<n.length;i++){if(n[i].toLowerCase()==s||m[i].toLowerCase()==s){return i;}}
return-1;};Date.getDayNumberFromName=function(name){var n=Date.CultureInfo.dayNames,m=Date.CultureInfo.abbreviatedDayNames,o=Date.CultureInfo.shortestDayNames,s=name.toLowerCase();for(var i=0;i<n.length;i++){if(n[i].toLowerCase()==s||m[i].toLowerCase()==s){return i;}}
return-1;};Date.isLeapYear=function(year){return(((year%4===0)&&(year%100!==0))||(year%400===0));};Date.getDaysInMonth=function(year,month){return[31,(Date.isLeapYear(year)?29:28),31,30,31,30,31,31,30,31,30,31][month];};Date.getTimezoneOffset=function(s,dst){return(dst||false)?Date.CultureInfo.abbreviatedTimeZoneDST[s.toUpperCase()]:Date.CultureInfo.abbreviatedTimeZoneStandard[s.toUpperCase()];};Date.getTimezoneAbbreviation=function(offset,dst){var n=(dst||false)?Date.CultureInfo.abbreviatedTimeZoneDST:Date.CultureInfo.abbreviatedTimeZoneStandard,p;for(p in n){if(n[p]===offset){return p;}}
return null;};Date.prototype.clone=function(){return new Date(this.getTime());};Date.prototype.compareTo=function(date){if(isNaN(this)){throw new Error(this);}
if(date instanceof Date&&!isNaN(date)){return(this>date)?1:(this<date)?-1:0;}else{throw new TypeError(date);}};Date.prototype.equals=function(date){return(this.compareTo(date)===0);};Date.prototype.between=function(start,end){var t=this.getTime();return t>=start.getTime()&&t<=end.getTime();};Date.prototype.addMilliseconds=function(value){this.setMilliseconds(this.getMilliseconds()+value);return this;};Date.prototype.addSeconds=function(value){return this.addMilliseconds(value*1000);};Date.prototype.addMinutes=function(value){return this.addMilliseconds(value*60000);};Date.prototype.addHours=function(value){return this.addMilliseconds(value*3600000);};Date.prototype.addDays=function(value){return this.addMilliseconds(value*86400000);};Date.prototype.addWeeks=function(value){return this.addMilliseconds(value*604800000);};Date.prototype.addMonths=function(value){var n=this.getDate();this.setDate(1);this.setMonth(this.getMonth()+value);this.setDate(Math.min(n,this.getDaysInMonth()));return this;};Date.prototype.addYears=function(value){return this.addMonths(value*12);};Date.prototype.add=function(config){if(typeof config=="number"){this._orient=config;return this;}
var x=config;if(x.millisecond||x.milliseconds){this.addMilliseconds(x.millisecond||x.milliseconds);}
if(x.second||x.seconds){this.addSeconds(x.second||x.seconds);}
if(x.minute||x.minutes){this.addMinutes(x.minute||x.minutes);}
if(x.hour||x.hours){this.addHours(x.hour||x.hours);}
if(x.month||x.months){this.addMonths(x.month||x.months);}
if(x.year||x.years){this.addYears(x.year||x.years);}
if(x.day||x.days){this.addDays(x.day||x.days);}
return this;};Date._validate=function(value,min,max,name){if(typeof value!="number"){throw new TypeError(value+" is not a Number.");}else if(value<min||value>max){throw new RangeError(value+" is not a valid value for "+name+".");}
return true;};Date.validateMillisecond=function(n){return Date._validate(n,0,999,"milliseconds");};Date.validateSecond=function(n){return Date._validate(n,0,59,"seconds");};Date.validateMinute=function(n){return Date._validate(n,0,59,"minutes");};Date.validateHour=function(n){return Date._validate(n,0,23,"hours");};Date.validateDay=function(n,year,month){return Date._validate(n,1,Date.getDaysInMonth(year,month),"days");};Date.validateMonth=function(n){return Date._validate(n,0,11,"months");};Date.validateYear=function(n){return Date._validate(n,1,9999,"seconds");};Date.prototype.set=function(config){var x=config;if(!x.millisecond&&x.millisecond!==0){x.millisecond=-1;}
if(!x.second&&x.second!==0){x.second=-1;}
if(!x.minute&&x.minute!==0){x.minute=-1;}
if(!x.hour&&x.hour!==0){x.hour=-1;}
if(!x.day&&x.day!==0){x.day=-1;}
if(!x.month&&x.month!==0){x.month=-1;}
if(!x.year&&x.year!==0){x.year=-1;}
if(x.millisecond!=-1&&Date.validateMillisecond(x.millisecond)){this.addMilliseconds(x.millisecond-this.getMilliseconds());}
if(x.second!=-1&&Date.validateSecond(x.second)){this.addSeconds(x.second-this.getSeconds());}
if(x.minute!=-1&&Date.validateMinute(x.minute)){this.addMinutes(x.minute-this.getMinutes());}
if(x.hour!=-1&&Date.validateHour(x.hour)){this.addHours(x.hour-this.getHours());}
if(x.month!==-1&&Date.validateMonth(x.month)){this.addMonths(x.month-this.getMonth());}
if(x.year!=-1&&Date.validateYear(x.year)){this.addYears(x.year-this.getFullYear());}
if(x.day!=-1&&Date.validateDay(x.day,this.getFullYear(),this.getMonth())){this.addDays(x.day-this.getDate());}
if(x.timezone){this.setTimezone(x.timezone);}
if(x.timezoneOffset){this.setTimezoneOffset(x.timezoneOffset);}
return this;};Date.prototype.clearTime=function(){this.setHours(0);this.setMinutes(0);this.setSeconds(0);this.setMilliseconds(0);return this;};Date.prototype.isLeapYear=function(){var y=this.getFullYear();return(((y%4===0)&&(y%100!==0))||(y%400===0));};Date.prototype.isWeekday=function(){return!(this.is().sat()||this.is().sun());};Date.prototype.getDaysInMonth=function(){return Date.getDaysInMonth(this.getFullYear(),this.getMonth());};Date.prototype.moveToFirstDayOfMonth=function(){return this.set({day:1});};Date.prototype.moveToLastDayOfMonth=function(){return this.set({day:this.getDaysInMonth()});};Date.prototype.moveToDayOfWeek=function(day,orient){var diff=(day-this.getDay()+7*(orient||+1))%7;return this.addDays((diff===0)?diff+=7*(orient||+1):diff);};Date.prototype.moveToMonth=function(month,orient){var diff=(month-this.getMonth()+12*(orient||+1))%12;return this.addMonths((diff===0)?diff+=12*(orient||+1):diff);};Date.prototype.getDayOfYear=function(){return Math.floor((this-new Date(this.getFullYear(),0,1))/86400000);};Date.prototype.getWeekOfYear=function(firstDayOfWeek){var y=this.getFullYear(),m=this.getMonth(),d=this.getDate();var dow=firstDayOfWeek||Date.CultureInfo.firstDayOfWeek;var offset=7+1-new Date(y,0,1).getDay();if(offset==8){offset=1;}
var daynum=((Date.UTC(y,m,d,0,0,0)-Date.UTC(y,0,1,0,0,0))/86400000)+1;var w=Math.floor((daynum-offset+7)/7);if(w===dow){y--;var prevOffset=7+1-new Date(y,0,1).getDay();if(prevOffset==2||prevOffset==8){w=53;}else{w=52;}}
return w;};Date.prototype.isDST=function(){console.log('isDST');return this.toString().match(/(E|C|M|P)(S|D)T/)[2]=="D";};Date.prototype.getTimezone=function(){return Date.getTimezoneAbbreviation(this.getUTCOffset,this.isDST());};Date.prototype.setTimezoneOffset=function(s){var here=this.getTimezoneOffset(),there=Number(s)*-6/10;this.addMinutes(there-here);return this;};Date.prototype.setTimezone=function(s){return this.setTimezoneOffset(Date.getTimezoneOffset(s));};Date.prototype.getUTCOffset=function(){var n=this.getTimezoneOffset()*-10/6,r;if(n<0){r=(n-10000).toString();return r[0]+r.substr(2);}else{r=(n+10000).toString();return"+"+r.substr(1);}};Date.prototype.getDayName=function(abbrev){return abbrev?Date.CultureInfo.abbreviatedDayNames[this.getDay()]:Date.CultureInfo.dayNames[this.getDay()];};Date.prototype.getMonthName=function(abbrev){return abbrev?Date.CultureInfo.abbreviatedMonthNames[this.getMonth()]:Date.CultureInfo.monthNames[this.getMonth()];};Date.prototype._toString=Date.prototype.toString;Date.prototype.toString=function(format){var self=this;var p=function p(s){return(s.toString().length==1)?"0"+s:s;};return format?format.replace(/dd?d?d?|MM?M?M?|yy?y?y?|hh?|HH?|mm?|ss?|tt?|zz?z?/g,function(format){switch(format){case"hh":return p(self.getHours()<13?self.getHours():(self.getHours()-12));case"h":return self.getHours()<13?self.getHours():(self.getHours()-12);case"HH":return p(self.getHours());case"H":return self.getHours();case"mm":return p(self.getMinutes());case"m":return self.getMinutes();case"ss":return p(self.getSeconds());case"s":return self.getSeconds();case"yyyy":return self.getFullYear();case"yy":return self.getFullYear().toString().substring(2,4);case"dddd":return self.getDayName();case"ddd":return self.getDayName(true);case"dd":return p(self.getDate());case"d":return self.getDate().toString();case"MMMM":return self.getMonthName();case"MMM":return self.getMonthName(true);case"MM":return p((self.getMonth()+1));case"M":return self.getMonth()+1;case"t":return self.getHours()<12?Date.CultureInfo.amDesignator.substring(0,1):Date.CultureInfo.pmDesignator.substring(0,1);case"tt":return self.getHours()<12?Date.CultureInfo.amDesignator:Date.CultureInfo.pmDesignator;case"zzz":case"zz":case"z":return"";}}):this._toString();};
Date.now2=function(){return new Date();};Date.today=function(){return Date.now2().clearTime();};Date.prototype._orient=+1;Date.prototype.next=function(){this._orient=+1;return this;};Date.prototype.last=Date.prototype.prev=Date.prototype.previous=function(){this._orient=-1;return this;};Date.prototype._is=false;Date.prototype.is=function(){this._is=true;return this;};Number.prototype._dateElement="day";Number.prototype.fromNow=function(){var c={};c[this._dateElement]=this;return Date.now2().add(c);};Number.prototype.ago=function(){var c={};c[this._dateElement]=this*-1;return Date.now2().add(c);};(function(){var $D=Date.prototype,$N=Number.prototype;var dx=("sunday monday tuesday wednesday thursday friday saturday").split(/\s/),mx=("january february march april may june july august september october november december").split(/\s/),px=("Millisecond Second Minute Hour Day Week Month Year").split(/\s/),de;var df=function(n){return function(){if(this._is){this._is=false;return this.getDay()==n;}
return this.moveToDayOfWeek(n,this._orient);};};for(var i=0;i<dx.length;i++){$D[dx[i]]=$D[dx[i].substring(0,3)]=df(i);}
var mf=function(n){return function(){if(this._is){this._is=false;return this.getMonth()===n;}
return this.moveToMonth(n,this._orient);};};for(var j=0;j<mx.length;j++){$D[mx[j]]=$D[mx[j].substring(0,3)]=mf(j);}
var ef=function(j){return function(){if(j.substring(j.length-1)!="s"){j+="s";}
return this["add"+j](this._orient);};};var nf=function(n){return function(){this._dateElement=n;return this;};};for(var k=0;k<px.length;k++){de=px[k].toLowerCase();$D[de]=$D[de+"s"]=ef(px[k]);$N[de]=$N[de+"s"]=nf(de);}}());Date.prototype.toJSONString=function(){return this.toString("yyyy-MM-ddThh:mm:ssZ");};Date.prototype.toShortDateString=function(){return this.toString(Date.CultureInfo.formatPatterns.shortDatePattern);};Date.prototype.toLongDateString=function(){return this.toString(Date.CultureInfo.formatPatterns.longDatePattern);};Date.prototype.toShortTimeString=function(){return this.toString(Date.CultureInfo.formatPatterns.shortTimePattern);};Date.prototype.toLongTimeString=function(){return this.toString(Date.CultureInfo.formatPatterns.longTimePattern);};Date.prototype.getOrdinal=function(){switch(this.getDate()){case 1:case 21:case 31:return"st";case 2:case 22:return"nd";case 3:case 23:return"rd";default:return"th";}};
(function(){Date.Parsing={Exception:function(s){this.message="Parse error at '"+s.substring(0,10)+" ...'";}};var $P=Date.Parsing;var _=$P.Operators={rtoken:function(r){return function(s){var mx=s.match(r);if(mx){return([mx[0],s.substring(mx[0].length)]);}else{throw new $P.Exception(s);}};},token:function(s){return function(s){return _.rtoken(new RegExp("^\s*"+s+"\s*"))(s);};},stoken:function(s){return _.rtoken(new RegExp("^"+s));},until:function(p){return function(s){var qx=[],rx=null;while(s.length){try{rx=p.call(this,s);}catch(e){qx.push(rx[0]);s=rx[1];continue;}
break;}
return[qx,s];};},many:function(p){return function(s){var rx=[],r=null;while(s.length){try{r=p.call(this,s);}catch(e){return[rx,s];}
rx.push(r[0]);s=r[1];}
return[rx,s];};},optional:function(p){return function(s){var r=null;try{r=p.call(this,s);}catch(e){return[null,s];}
return[r[0],r[1]];};},not:function(p){return function(s){try{p.call(this,s);}catch(e){return[null,s];}
throw new $P.Exception(s);};},ignore:function(p){return p?function(s){var r=null;r=p.call(this,s);return[null,r[1]];}:null;},product:function(){var px=arguments[0],qx=Array.prototype.slice.call(arguments,1),rx=[];for(var i=0;i<px.length;i++){rx.push(_.each(px[i],qx));}
return rx;},cache:function(rule){var cache={},r=null;return function(s){try{r=cache[s]=(cache[s]||rule.call(this,s));}catch(e){r=cache[s]=e;}
if(r instanceof $P.Exception){throw r;}else{return r;}};},any:function(){var px=arguments;return function(s){var r=null;for(var i=0;i<px.length;i++){if(px[i]==null){continue;}
try{r=(px[i].call(this,s));}catch(e){r=null;}
if(r){return r;}}
throw new $P.Exception(s);};},each:function(){var px=arguments;return function(s){var rx=[],r=null;for(var i=0;i<px.length;i++){if(px[i]==null){continue;}
try{r=(px[i].call(this,s));}catch(e){throw new $P.Exception(s);}
rx.push(r[0]);s=r[1];}
return[rx,s];};},all:function(){var px=arguments,_=_;return _.each(_.optional(px));},sequence:function(px,d,c){d=d||_.rtoken(/^\s*/);c=c||null;if(px.length==1){return px[0];}
return function(s){var r=null,q=null;var rx=[];for(var i=0;i<px.length;i++){try{r=px[i].call(this,s);}catch(e){break;}
rx.push(r[0]);try{q=d.call(this,r[1]);}catch(ex){q=null;break;}
s=q[1];}
if(!r){throw new $P.Exception(s);}
if(q){throw new $P.Exception(q[1]);}
if(c){try{r=c.call(this,r[1]);}catch(ey){throw new $P.Exception(r[1]);}}
return[rx,(r?r[1]:s)];};},between:function(d1,p,d2){d2=d2||d1;var _fn=_.each(_.ignore(d1),p,_.ignore(d2));return function(s){var rx=_fn.call(this,s);return[[rx[0][0],r[0][2]],rx[1]];};},list:function(p,d,c){d=d||_.rtoken(/^\s*/);c=c||null;return(p instanceof Array?_.each(_.product(p.slice(0,-1),_.ignore(d)),p.slice(-1),_.ignore(c)):_.each(_.many(_.each(p,_.ignore(d))),px,_.ignore(c)));},set:function(px,d,c){d=d||_.rtoken(/^\s*/);c=c||null;return function(s){var r=null,p=null,q=null,rx=null,best=[[],s],last=false;for(var i=0;i<px.length;i++){q=null;p=null;r=null;last=(px.length==1);try{r=px[i].call(this,s);}catch(e){continue;}
rx=[[r[0]],r[1]];if(r[1].length>0&&!last){try{q=d.call(this,r[1]);}catch(ex){last=true;}}else{last=true;}
if(!last&&q[1].length===0){last=true;}
if(!last){var qx=[];for(var j=0;j<px.length;j++){if(i!=j){qx.push(px[j]);}}
p=_.set(qx,d).call(this,q[1]);if(p[0].length>0){rx[0]=rx[0].concat(p[0]);rx[1]=p[1];}}
if(rx[1].length<best[1].length){best=rx;}
if(best[1].length===0){break;}}
if(best[0].length===0){return best;}
if(c){try{q=c.call(this,best[1]);}catch(ey){throw new $P.Exception(best[1]);}
best[1]=q[1];}
return best;};},forward:function(gr,fname){return function(s){return gr[fname].call(this,s);};},replace:function(rule,repl){return function(s){var r=rule.call(this,s);return[repl,r[1]];};},process:function(rule,fn){return function(s){var r=rule.call(this,s);return[fn.call(this,r[0]),r[1]];};},min:function(min,rule){return function(s){var rx=rule.call(this,s);if(rx[0].length<min){throw new $P.Exception(s);}
return rx;};}};var _generator=function(op){return function(){var args=null,rx=[];if(arguments.length>1){args=Array.prototype.slice.call(arguments);}else if(arguments[0]instanceof Array){args=arguments[0];}
if(args){for(var i=0,px=args.shift();i<px.length;i++){args.unshift(px[i]);rx.push(op.apply(null,args));args.shift();return rx;}}else{return op.apply(null,arguments);}};};var gx="optional not ignore cache".split(/\s/);for(var i=0;i<gx.length;i++){_[gx[i]]=_generator(_[gx[i]]);}
var _vector=function(op){return function(){if(arguments[0]instanceof Array){return op.apply(null,arguments[0]);}else{return op.apply(null,arguments);}};};var vx="each any all".split(/\s/);for(var j=0;j<vx.length;j++){_[vx[j]]=_vector(_[vx[j]]);}}());(function(){var flattenAndCompact=function(ax){var rx=[];for(var i=0;i<ax.length;i++){if(ax[i]instanceof Array){rx=rx.concat(flattenAndCompact(ax[i]));}else{if(ax[i]){rx.push(ax[i]);}}}
return rx;};Date.Grammar={};Date.Translator={hour:function(s){return function(){this.hour=Number(s);};},minute:function(s){return function(){this.minute=Number(s);};},second:function(s){return function(){this.second=Number(s);};},meridian:function(s){return function(){this.meridian=s.slice(0,1).toLowerCase();};},timezone:function(s){return function(){var n=s.replace(/[^\d\+\-]/g,"");if(n.length){this.timezoneOffset=Number(n);}else{this.timezone=s.toLowerCase();}};},day:function(x){var s=x[0];return function(){this.day=Number(s.match(/\d+/)[0]);};},month:function(s){return function(){this.month=((s.length==3)?Date.getMonthNumberFromName(s):(Number(s)-1));};},year:function(s){return function(){var n=Number(s);this.year=((s.length>2)?n:(n+(((n+2000)<Date.CultureInfo.twoDigitYearMax)?2000:1900)));};},rday:function(s){return function(){switch(s){case"yesterday":this.days=-1;break;case"tomorrow":this.days=1;break;case"today":this.days=0;break;case"now":this.days=0;this.now=true;break;}};},finishExact:function(x){x=(x instanceof Array)?x:[x];var now=new Date();this.year=now.getFullYear();this.month=now.getMonth();this.day=1;this.hour=0;this.minute=0;this.second=0;for(var i=0;i<x.length;i++){if(x[i]){x[i].call(this);}}
this.hour=(this.meridian=="p"&&this.hour<13)?this.hour+12:this.hour;if(this.day>Date.getDaysInMonth(this.year,this.month)){throw new RangeError(this.day+" is not a valid value for days.");}
var r=new Date(this.year,this.month,this.day,this.hour,this.minute,this.second);if(this.timezone){r.set({timezone:this.timezone});}else if(this.timezoneOffset){r.set({timezoneOffset:this.timezoneOffset});}
return r;},finish:function(x){x=(x instanceof Array)?flattenAndCompact(x):[x];if(x.length===0){return null;}
for(var i=0;i<x.length;i++){if(typeof x[i]=="function"){x[i].call(this);}}
if(this.now){return new Date();}
var today=Date.today();var method=null;var expression=!!(this.days!=null||this.orient||this.operator);if(expression){var gap,mod,orient;orient=((this.orient=="past"||this.operator=="subtract")?-1:1);if(this.weekday){this.unit="day";gap=(Date.getDayNumberFromName(this.weekday)-today.getDay());mod=7;this.days=gap?((gap+(orient*mod))%mod):(orient*mod);}
if(this.month){this.unit="month";gap=(this.month-today.getMonth());mod=12;this.months=gap?((gap+(orient*mod))%mod):(orient*mod);this.month=null;}
if(!this.unit){this.unit="day";}
if(this[this.unit+"s"]==null||this.operator!=null){if(!this.value){this.value=1;}
if(this.unit=="week"){this.unit="day";this.value=this.value*7;}
this[this.unit+"s"]=this.value*orient;}
return today.add(this);}else{if(this.meridian&&this.hour){this.hour=(this.hour<13&&this.meridian=="p")?this.hour+12:this.hour;}
if(this.weekday&&!this.day){this.day=(today.addDays((Date.getDayNumberFromName(this.weekday)-today.getDay()))).getDate();}
if(this.month&&!this.day){this.day=1;}
return today.set(this);}}};var _=Date.Parsing.Operators,g=Date.Grammar,t=Date.Translator,_fn;g.datePartDelimiter=_.rtoken(/^([\s\-\.\,\/\x27]+)/);g.timePartDelimiter=_.stoken(":");g.whiteSpace=_.rtoken(/^\s*/);g.generalDelimiter=_.rtoken(/^(([\s\,]|at|on)+)/);var _C={};g.ctoken=function(keys){var fn=_C[keys];if(!fn){var c=Date.CultureInfo.regexPatterns;var kx=keys.split(/\s+/),px=[];for(var i=0;i<kx.length;i++){px.push(_.replace(_.rtoken(c[kx[i]]),kx[i]));}
fn=_C[keys]=_.any.apply(null,px);}
return fn;};g.ctoken2=function(key){return _.rtoken(Date.CultureInfo.regexPatterns[key]);};g.h=_.cache(_.process(_.rtoken(/^(0[0-9]|1[0-2]|[1-9])/),t.hour));g.hh=_.cache(_.process(_.rtoken(/^(0[0-9]|1[0-2])/),t.hour));g.H=_.cache(_.process(_.rtoken(/^([0-1][0-9]|2[0-3]|[0-9])/),t.hour));g.HH=_.cache(_.process(_.rtoken(/^([0-1][0-9]|2[0-3])/),t.hour));g.m=_.cache(_.process(_.rtoken(/^([0-5][0-9]|[0-9])/),t.minute));g.mm=_.cache(_.process(_.rtoken(/^[0-5][0-9]/),t.minute));g.s=_.cache(_.process(_.rtoken(/^([0-5][0-9]|[0-9])/),t.second));g.ss=_.cache(_.process(_.rtoken(/^[0-5][0-9]/),t.second));g.hms=_.cache(_.sequence([g.H,g.mm,g.ss],g.timePartDelimiter));g.t=_.cache(_.process(g.ctoken2("shortMeridian"),t.meridian));g.tt=_.cache(_.process(g.ctoken2("longMeridian"),t.meridian));g.z=_.cache(_.process(_.rtoken(/^(\+|\-)?\s*\d\d\d\d?/),t.timezone));g.zz=_.cache(_.process(_.rtoken(/^(\+|\-)\s*\d\d\d\d/),t.timezone));g.zzz=_.cache(_.process(g.ctoken2("timezone"),t.timezone));g.timeSuffix=_.each(_.ignore(g.whiteSpace),_.set([g.tt,g.zzz]));g.time=_.each(_.optional(_.ignore(_.stoken("T"))),g.hms,g.timeSuffix);g.d=_.cache(_.process(_.each(_.rtoken(/^([0-2]\d|3[0-1]|\d)/),_.optional(g.ctoken2("ordinalSuffix"))),t.day));g.dd=_.cache(_.process(_.each(_.rtoken(/^([0-2]\d|3[0-1])/),_.optional(g.ctoken2("ordinalSuffix"))),t.day));g.ddd=g.dddd=_.cache(_.process(g.ctoken("sun mon tue wed thu fri sat"),function(s){return function(){this.weekday=s;};}));g.M=_.cache(_.process(_.rtoken(/^(1[0-2]|0\d|\d)/),t.month));g.MM=_.cache(_.process(_.rtoken(/^(1[0-2]|0\d)/),t.month));g.MMM=g.MMMM=_.cache(_.process(g.ctoken("jan feb mar apr may jun jul aug sep oct nov dec"),t.month));g.y=_.cache(_.process(_.rtoken(/^(\d\d?)/),t.year));g.yy=_.cache(_.process(_.rtoken(/^(\d\d)/),t.year));g.yyy=_.cache(_.process(_.rtoken(/^(\d\d?\d?\d?)/),t.year));g.yyyy=_.cache(_.process(_.rtoken(/^(\d\d\d\d)/),t.year));_fn=function(){return _.each(_.any.apply(null,arguments),_.not(g.ctoken2("timeContext")));};g.day=_fn(g.d,g.dd);g.month=_fn(g.M,g.MMM);g.year=_fn(g.yyyy,g.yy);g.orientation=_.process(g.ctoken("past future"),function(s){return function(){this.orient=s;};});g.operator=_.process(g.ctoken("add subtract"),function(s){return function(){this.operator=s;};});g.rday=_.process(g.ctoken("yesterday tomorrow today now"),t.rday);g.unit=_.process(g.ctoken("minute hour day week month year"),function(s){return function(){this.unit=s;};});g.value=_.process(_.rtoken(/^\d\d?(st|nd|rd|th)?/),function(s){return function(){this.value=s.replace(/\D/g,"");};});g.expression=_.set([g.rday,g.operator,g.value,g.unit,g.orientation,g.ddd,g.MMM]);_fn=function(){return _.set(arguments,g.datePartDelimiter);};g.mdy=_fn(g.ddd,g.month,g.day,g.year);g.ymd=_fn(g.ddd,g.year,g.month,g.day);g.dmy=_fn(g.ddd,g.day,g.month,g.year);g.date=function(s){return((g[Date.CultureInfo.dateElementOrder]||g.mdy).call(this,s));};g.format=_.process(_.many(_.any(_.process(_.rtoken(/^(dd?d?d?|MM?M?M?|yy?y?y?|hh?|HH?|mm?|ss?|tt?|zz?z?)/),function(fmt){if(g[fmt]){return g[fmt];}else{throw Date.Parsing.Exception(fmt);}}),_.process(_.rtoken(/^[^dMyhHmstz]+/),function(s){return _.ignore(_.stoken(s));}))),function(rules){return _.process(_.each.apply(null,rules),t.finishExact);});var _F={};var _get=function(f){return _F[f]=(_F[f]||g.format(f)[0]);};g.formats=function(fx){if(fx instanceof Array){var rx=[];for(var i=0;i<fx.length;i++){rx.push(_get(fx[i]));}
return _.any.apply(null,rx);}else{return _get(fx);}};g._formats=g.formats(["yyyy-MM-ddTHH:mm:ss","ddd, MMM dd, yyyy H:mm:ss tt","ddd MMM d yyyy HH:mm:ss zzz","d"]);g._start=_.process(_.set([g.date,g.time,g.expression],g.generalDelimiter,g.whiteSpace),t.finish);g.start=function(s){try{var r=g._formats.call({},s);if(r[1].length===0){return r;}}catch(e){}
return g._start.call({},s);};}());Date._parse=Date.parse;Date.parse=function(s){var r=null;if(!s){return null;}
try{r=Date.Grammar.start.call({},s);}catch(e){return null;}
return((r[1].length===0)?r[0]:null);};Date.getParseFunction=function(fx){var fn=Date.Grammar.formats(fx);return function(s){var r=null;try{r=fn.call({},s);}catch(e){return null;}
return((r[1].length===0)?r[0]:null);};};Date.parseExact=function(s,fx){return Date.getParseFunction(fx)(s);};

}// END: if (!Date.CultureInfo) {	// Only initialize DateJS if it doesn't already exist in the current scope.


//@ sourceURL=calendar/utils.js

/* Copyright 2010 Palm, Inc.  All rights reserved. */

/*global Class: false, exports: false, PalmCall: false, Config, console*/
/*jslint laxbreak: true, white: false */

function Utils() {
	
}

Utils.prototype = {
	
	//Number of days in each month of a leap year
	leapYearDaysInMonth:    [31,  29,  31,  30,  31,  30,  31,  31,  30,  31,  30,  31],

	//Number of days since January 1 at the end of each month of a leap year
	leapYearDaysCumulative: [31,  60,  91, 121, 152, 182, 213, 244, 274, 305, 335, 366],
	
	//Number of days in each month of a regular year
	regularYearDaysInMonth:    [31,  28,  31,  30,  31,  30,  31,  31,  30,  31,  30,  31],
	
	//Number of days since January 1 at the end of each month of a regular year
	regularYearDaysCumulative: [31,  59,  90, 120, 151, 181, 212, 243, 273, 304, 334, 365],
	
	//Number of days until December 31 at the start of each month of a leap year
	leapYearDaysCumulativeReverse:    [366, 335, 306, 275, 245, 214, 184, 153, 122,  92,  61,  31],
	
	//Number of days until December 31 at the start of each month of a regular year
	regularYearDaysCumulativeReverse: [365, 334, 306, 275, 245, 214, 184, 153, 122,  92,  61,  31],	
	
	importDateJS : function (DateClass) {
	
		var DateJS	= Date.prototype
		,	member
		,	local	= DateClass.prototype;
	
		// Copy DateJS modified Date's members to the supplied DateClass:
		for (member in Date) {
			if (!(member in DateClass)) {
				DateClass [member] = Date [member];
			}
		}
	
		// Copy DateJS modified Date's protoype members to the supplied DateClass:
		for (member in DateJS) {
			if (!(member in local)) {
				local [member] = DateJS [member];
			}
		}
	},


	//Returns true if the year is a leap year
	isLeapYear: function (year) {
		if (year % 4) {
			return false;
		}
		if (year % 400 === 0) {
			return true;
		}
		if (year % 100 === 0) {
			return false;
		}
		return true;	
	},
	
	//finds # of days between January 1 and the given date, in the year of the given date.
	//Timezone agnostic
	howManyDaysSinceJanuaryFirst: function (date) {
		var howManyDays = 0;
		var day = date.getDate();
		var year = date.getFullYear();
		var previousMonth = date.getMonth() - 1;
	
		//add the days for all previous months
		if(previousMonth >= 0) {
			if (this.isLeapYear(year)) {
				howManyDays = this.leapYearDaysCumulative[previousMonth];
			}
			else {
				howManyDays = this.regularYearDaysCumulative[previousMonth];
			}
		}
		
		//add the days for the current month
		howManyDays += (day-1);	
		
		return howManyDays;
	},
	
	//finds # of days between the given date and December 31, in the year of the given date.
	//Timezone agnostic
	howManyDaysTillDecember31: function (date) {
		var howManyDays = 0;
		var day = date.getDate();
		var year = date.getFullYear();
		var month = date.getMonth();
		var nextMonth = date.getMonth()+1;
		var daysInMonthArray = this.regularYearDaysInMonth;
	
		//add the days for all months after the current month
		if(nextMonth < 12) {
			if(this.isLeapYear(year)){
				daysInMonthArray = this.leapYearDaysInMonth;
				howManyDays = this.leapYearDaysCumulativeReverse[nextMonth];
			}
			else {
				howManyDays = this.regularYearDaysCumulativeReverse[nextMonth];	
			}
		}
		
		//add the days left in the current month
		howManyDays += (daysInMonthArray[month] - day);	
		
		return howManyDays;
	},
	
	//finds # of days between two given dates.
	//Require: dates are within the same year
	//Require: startRange < endRange
	//Timezone agnostic		
	howManyDaysBetweenShortRange: function (startDate, endDate) {
		var howManyDays = 0;
		var daysInMonthArray = this.regularYearDaysInMonth;
		var cumulativeArray = this.regularYearDaysCumulative;
		var startMonth = startDate.getMonth();
		var startDay = startDate.getDate();
		var year = startDate.getFullYear();
	
		var endMonth = endDate.getMonth();
		var endDay = endDate.getDate();
		var monthDiff = endMonth - startMonth;
		
		//if we are within the same month
		if(monthDiff === 0) {
			return (endDay - startDay);
		} else {
			if(this.isLeapYear(year)) {
				daysInMonthArray = this.leapYearDaysInMonth;
				cumulativeArray = this.leapYearDaysCumulative;
			}
		
			//add days left in the start month
			howManyDays += (daysInMonthArray[startMonth] - startDay);	
			
			//add days past in the end month
			howManyDays += endDay;                                     
			
			//add days in months in between
			if (monthDiff > 1) {
				howManyDays += (cumulativeArray[endMonth - 1] - cumulativeArray[startMonth]);
			}
		}
		
		return howManyDays;
	},
	
	//finds # of days between two given dates.
	//Require: startRange < endRange
	//Timezone agnostic
	howManyDaysBetween: function (startDate, endDate){
		var howManyDays = 0;	
		var startYear = startDate.getFullYear();
		var endYear = endDate.getFullYear();
		if(startYear == endYear){
			howManyDays = this.howManyDaysBetweenShortRange(startDate, endDate);
		} else {
			howManyDays += this.howManyDaysTillDecember31(startDate);
			howManyDays += this.howManyDaysSinceJanuaryFirst(endDate) +1;
			
			for(var year = startYear+1; year < endYear; year++){
				if (this.isLeapYear(year)) {
					howManyDays += 366;
				}
				else {
					howManyDays += 365;
				}
			}
		}
		return howManyDays;
	},
	
	//finds # of whole months between two given dates.
	//Require: startDate < endDate
	//Timezone agnostic
	howManyMonthsBetween: function (startDate, endDate){
		var howManyMonths = 0;
		
		var startMonth = startDate.getMonth();  
		var startYear = startDate.getFullYear();
	
		var endMonth = endDate.getMonth();  
		var endYear = endDate.getFullYear();
	
		if(startYear == endYear) {
			return endMonth - startMonth;
		} else {
			howManyMonths += (12 - startMonth);  
			howManyMonths += endMonth;          
			howManyMonths += (endYear - startYear - 1) * 12;  
		}
		return howManyMonths;
	},
	
	//finds # of whole weeks (7 day periods) between two given dates.
	//Require: startRange < endRange
	//Timezone agnostic
	howManyWeeksBetween: function (startDate, endDate) {
		var days = this.howManyDaysBetween(startDate, endDate);
		return Math.floor(days / 7);
	},
	
	//Dissects the period specified by startDate and endDate into the 
	//number of years, months, days, hours, and minutes between the two.
	//Returns an object formatted: {years, months, days, hours, minutes}.
	getTimePeriodParts: function(startDate, endDate, isAllDay){
		
		var period = {years: 0, months: 0, days: 0, hours: 0, minutes: 0};	
			
		var monthsBetween = this.howManyMonthsBetween(startDate, endDate);
		if (startDate.getDate() > endDate.getDate()) {
			monthsBetween--;
		}
		period.years = Math.floor(monthsBetween / 12);
		period.months = monthsBetween % 12;
		
		if (endDate.getDate() >= startDate.getDate()) {
			period.days = endDate.getDate() - startDate.getDate();
		}
		else {
			var jumpDate = startDate.getDate();
			var jumpMonth = endDate.getMonth() - 1;
			var jumpYear = endDate.getFullYear();
			if (jumpMonth < 0) {
				jumpMonth = 11;
				jumpYear--;
			}
			var tempDate = new Date(jumpYear, jumpMonth, jumpDate);
			period.days = this.howManyDaysBetween(tempDate, endDate);
		}
		
		if (endDate.getHours() >= startDate.getHours()) {
			period.hours = endDate.getHours() - startDate.getHours();
		}
		else {
			period.hours = endDate.getHours() + 24 - startDate.getHours();
			period.days--;
		}
			
		if (endDate.getMinutes() >= startDate.getMinutes()) {
			period.minutes = endDate.getMinutes() - startDate.getMinutes();
		}
		else {
			period.minutes = endDate.getMinutes() + 60 - startDate.getMinutes();
			period.hours--;
		}
		
		if(isAllDay){
			period.days++;
			period.hours = 0;
			period.minutes = 0;	
		}
				
		return period;
	}

};

(function(){
	/** Closure to hold private singular Utils instance. */

	// Create the singular private Utils instance:
	var singleton = new Utils();

	// Override the Utils constructor to always returns its singular instance:
	Utils = function Utils(){
		return singleton;
	};
	
	Utils.log = function () {
		var argsArr = Array.prototype.slice.call(arguments, 0);
		Utils._logBase("log", argsArr);
	};

	Utils.warn = function () {
		var argsArr = Array.prototype.slice.call(arguments, 0);
		Utils._logBase("warn", argsArr);
	};

	Utils.error = function () {
		var argsArr = Array.prototype.slice.call(arguments, 0);
		Utils._logBase("error", argsArr);
	};

	Utils.debug = function() {
		if (Config && Config.logs === "debug") {
			var argsArr = Array.prototype.slice.call(arguments, 0);
			Utils._logBase("log", argsArr);
		}
	};
	
	Utils._logBase = function (method, argsArr) {
		var data = argsArr.reduce(function (accumulatedMessage, curArg) {
			if (typeof curArg === "string") {
				return accumulatedMessage + curArg;
			} else {
				return accumulatedMessage + JSON.stringify(curArg);
			}
		}, "");

		if (Config && Config.logs === "verbose") {
			// I want ALL my logs!
			data = data.split("\n");
			var i, pos, datum;
			for (i = 0; i < data.length; ++i) {
				datum = data[i];
				if (datum.length < 500) {
					console[method](datum);
				} else {
					// Do our own wrapping
					for (pos = 0; pos < datum.length; pos += 500) {
						console[method](datum.slice(pos, pos + 500));
					}
				}
			}
		} else {
			console[method](data);
		}
	};
})();

exports.Utils = Utils;

//@ sourceURL=calendar/timezone-manager.js

/* Copyright 2010 Palm, Inc.  All rights reserved. */
/*
 * DateRange
 * {	Date	start
 * ,	Date	end
 * ,	String	tzId
 * ,	String	calendarId
 * }
 * 
 * TimezoneYear
 * {	String	tz
 * ,	Array	years [YYYY]
 * }
 */

/*global _: false, Class: false, exports: false, Future, PalmCall: false, Utils: false, stringify */
/*jslint devel: true, laxbreak: true, white: false */

var TimezoneManager = Class.create ({

	initialize: function() {
		// Bind all of our methods so they will always get called on the correct object
		_.bindAll(this);
		
		this.timezones		= {};		
		this.timezone		= undefined;
		this.gotLocalTz		= false;
		this.defaultYears	= [];
		this.setupFutures	= [];

		for (var year = new Date().getFullYear(), i = -5; i < 6; ++i) {
			this.defaultYears.push (year + i);
		}
	},

	setup: function() {
		// The problem: callers need TimezoneManager to be fully set-up before
		// they can proceed, but idomatic handling of subscriptions results in
		// a never-ending chain of recursing then()s.
		//
		// The solution: the first time we call getSystemTime, we don't subscribe,
		// and return a new future (which we cache for later notification) for 
		// each caller to attach then()s to.  Once we've gotten a response from
		// the server, we set the result on the cached futures, allowing the
		// callers to go about their business, and then subscribe to getSystemTime.
		// After this point, callers get a "resulted" future returned to them.
		//
		// Callers get unique futures because you never know what each caller
		// will do with their future, and later callers shouldn't be left waiting
		// on earlier callers to finish.

		function getSystemTime(self, then, subscribe) {
			return PalmCall.call("palm://com.palm.systemservice", "time/getSystemTime", {subscribe: subscribe}).then(self, then);
		}

		function handleSubscribe(future) {
			Utils.debug("TimezoneManager.setup(): 8. Subscription response from getSystemTime received");
			var result = future.result;

			Utils.debug("TimezoneManager.setup(): 9. Calling setTimezone() from subscription");
			this.setTimezone(result);

			//register a new "then" with this same function
			Utils.debug("TimezoneManager.setup(): 10. Continuing subscription to getSystemTime");
			future.then(this, handleSubscribe);
		}

		function handleFirstResponse(future) {
			Utils.debug("TimezoneManager.setup(): 4. First response from getSystemTime received");
			var result = future.result,
				setupFuture;

			Utils.debug("TimezoneManager.setup(): 5. Calling setTimezone()");
			this.setTimezone(result);

			// Now notify all our callers that set up is complete
			while ((setupFuture = this.setupFutures.pop())) {
				Utils.debug("TimezoneManager.setup(): 6. Notifying caller that setup is complete");
				setupFuture.result = {returnValue: true};
			}

			// And subscribe to getSystemTime
			Utils.debug("TimezoneManager.setup(): 7. Subscribing to getSystemTime");
			this.sysTzFuture = getSystemTime(this, handleSubscribe, true);
			future.result = {returnValue: true};
		}

		if (!this.timezone) {
			// If there's no timezone, we haven't gotten a response from the 
			// service (possibly because we haven't made the request yet).

			// Create a new future for the caller to wait on, and cache it.
			Utils.debug("TimezoneManager.setup(): 1. timezone not setup; creating and caching future for caller");
			var callerFuture = new Future();
			this.setupFutures.push(callerFuture);

			// Make the getSystemTime request if we haven't yet
			if (!this.sysTzFuture) {
				Utils.debug("TimezoneManager.setup(): 2. Make initial request to getSystemTime");
				this.sysTzFuture = getSystemTime(this, handleFirstResponse, false);
			}

			Utils.debug("TimezoneManager.setup(): 3. Returning future to caller");
			return callerFuture;
		}

		// We're fully set up, so give the caller a future that allows them to
		// continue immediately
		return new Future({returnValue: true});
	},

	setTimezone: function(response) {
		this.timezone	= response.timezone;
		this.gotLocalTz	= false;
	},
	
	getSystemTimezone: function(){
		return this.timezone;
	},
	
	cleanup: function() {
		this.sysTzFuture.cancel();
	},
		
	/*
	 * Called from getEventsSuccess.  This function requires:
	 * tzIds: an array of tzIds
	 * years: an array of years
	 * 
	 * If the params are not present, default them.
	 * Verify if every tz-year pair is already in our cache. If so, do nothing, return.
	 * If not, fetch the data from the service, and return.	 
	 */
	loadTimezones: function(tzIds, years){
		var tzYearPairs,
			future;

		if(!tzIds || tzIds.length === 0){
			tzIds = [this.timezone];
		}
		if(!years || years.length === 0){
			years = this.defaultYears;
		}
		if(!this.gotLocalTz && this.timezone){
			tzIds.push(this.timezone);
			this.gotLocalTz = true;
		}			
					
		tzYearPairs = this.findTzYearPairsNotInCache(tzIds, years);
		if(tzYearPairs.length > 0){
			future = PalmCall.call("palm://com.palm.systemservice/timezone/", "getTimeZoneRules", tzYearPairs);
			future.then(this, this.addTimezones, this.failedToGetTimezones);
		} else {
			future = new Future({returnValue: true});
		}
		return future;
	},
	
	/*
	 * Called from getEventsInRange.  This function requires a future, and expects that the future has two params attached to it:
	 * tzIds: an array of tzIds
	 * years: an array of years
	 * 
	 * If the params are not present, default them.
	 * Verify if every tz-year pair is already in our cache. If so, do nothing, return.
	 * If not, fetch the data from the service, and return.	 
	 */
	getTimezones: function (incomingFuture){

		incomingFuture.getResult();

		var tzIds = incomingFuture.tzIds;
		var years = incomingFuture.years;

		var tzFuture = this.loadTimezones(tzIds, years);
		incomingFuture.nest (tzFuture);
	},
		
	findTzYearPairsNotInCache: function(tzIds, years){
		//See if we need to get any tzInfos from the service
		var tzPairs = [];
		var tzIdsLength = tzIds.length;
		var yearsLength = years.length;
		for(var i = 0; i < tzIdsLength; i++){
			var timezone = tzIds[i];
			var tzYears = [];
			for(var j = 0; j < yearsLength; j++){
				var year = years[j];
				if(!this.hasTimezoneInfo(timezone, year)){
					tzYears.push(year);
				}
			}
			if(tzYears.length > 0){
				tzPairs.push(this.makeTimezoneYearPair(timezone, tzYears));
			}
		}
		return tzPairs;
	},
	
	failedToGetTimezones: function(future){
		if (future.exception) {
			future.result = false;
		}
		else {
			future.result = true;
		}
	},
	
	addTimezones: function(future){
		/* "results": 
		 * [ { "tz": "America\/Los_Angeles", "year": 2009, "hasDstChange": true, "utcOffset": -28800, "dstOffset": -25200, "dstStart": 1236506400, "dstEnd": 1257066000 },
		 *	 { "tz": "UTC", "year": 2010, "hasDstChange": false, "utcOffset": 0, "dstOffset": -1, "dstStart": -1, "dstEnd": -1 } 
		 * ] 
		 */
		var result;
		try {
			result = future.result;
		} catch (e) {
			future.result = {returnValue: false};
			return;
		}
		
		var returnValue = result.returnValue;
		if (returnValue === false) {
			
			future.result = {returnValue: returnValue};
			return;
		}
		
		var results = future.result.results;
		var length = results.length;
		var tzinfo;
		for(var i = 0; i < length; i++){
			tzinfo = results[i];
			var year = tzinfo.year;
			if(!this.timezones [year]){
				this.timezones [year] = {};
			}				
			this.timezones [year][tzinfo.tz] = tzinfo;
		}
		future.result = {returnValue: returnValue};
	},
	
	hasTimezoneInfo: function(tzId, year){
		return !!(this.timezones[year] && this.timezones[year][tzId]);
	},
	 
	makeTimezoneYearPair: function(tzId, years){
		var allYears;
		if(!years || years.length === 0){
			allYears = this.defaultYears;
		}
		else if(JSON.stringify(years) != JSON.stringify(this.defaultYears)){
			allYears = years.concat(this.defaultYears);
		}
		else{
			allYears = years;
		}
			
		var pair = {"tz":tzId, "years":allYears};
		return pair;			
	},
	
	//write a unit test for this
	convertTime: function(timestamp, srcTz, destTz){
		var defaultTz = this.timezone;
		var source = srcTz || defaultTz;
		var dest = destTz || defaultTz;
		
		if(source == dest){
			return timestamp;
		}
				
		var year = new Date(timestamp).getFullYear(); //um, if src isn't local, how do we know if we got the right year until after we get an offset?
		var timestampNoMillis = timestamp / 1000;		
		var destOffset = this.getOffset(year, dest, timestampNoMillis);
		var sourceOffset = this.getOffset(year, source, timestampNoMillis);
		var convertedTime = (timestampNoMillis + destOffset - sourceOffset) * 1000;
		return convertedTime;					
	},
	
	//{ "tz": "America\/Los_Angeles", "year": 2009, "hasDstChange": true, "utcOffset": -28800, "dstOffset": -25200, "dstStart": 1236506400, "dstEnd": 1257066000 },
	getOffset: function(year, tzId, timestampNoMillis){
		if(!tzId){
			tzId = this.timezone;
		}
		else if( /UTC/i.test (tzId) ){
			return 0;
		}
		
		var tzInfoYr = this.timezones[year];
		if(!tzInfoYr){
			//console.info("Timezone Manager didn't load %s", year);
			return 0;
		}
		
		var tzInfo = this.timezones[year][tzId];
		if(!tzInfo){
			//console.info("Timezone Manager didn't load %s/%s", tzId, year);
			return 0;
		}
	
		if(!tzInfo.hasDstChange){
			return tzInfo.utcOffset;
		}
		else if(tzInfo.dstStart <= tzInfo.dstEnd
			? (timestampNoMillis >= tzInfo.dstStart && timestampNoMillis < tzInfo.dstEnd)
			: (timestampNoMillis >= tzInfo.dstStart || timestampNoMillis < tzInfo.dstEnd)){	// webOS CE: south of the equator, dstStart comes after dstEnd.
			return tzInfo.dstOffset;
		}
		
		return tzInfo.utcOffset;
	}
});

(function(){
	/** Closure to hold private singular TimezoneManager instance. */

	// Create the singular private TimezoneManager instance:
	var singleton = new TimezoneManager();

	// Override the TimezoneManager constructor to always returns its singular instance:
	TimezoneManager = function TimezoneManager(){
		return singleton;
	};

})();

exports.TimezoneManager = TimezoneManager;


//@ sourceURL=calendar/rrule-manager.js

/* Copyright 2010 Palm, Inc.  All rights reserved. */

/*global Utils: false, exports: false */
/*jslint laxbreak: true, white: false */
function RRuleManager(){
	this.utils = new Utils();
}

RRuleManager.prototype = {
	
	flagPositions :  
	{
		byMonth		: 0,
		byMonthDay	: 1,
		byDay		: 2,
		byYearDay	: 3,
		byWeekNumber: 4
	},
	
	hasRules : 
	{
		byMonth		: 1, //(1 << 0) 
		byMonthDay	: 2, //(1 << 1)
		byDay		: 4, //(1 << 2)
		byYearDay	: 8, //(1 << 3)
		byWeekNumber: 16 //(1 << 4)
	}, 
	
	rlog: function(string){
		//console.info("========== rrulemgr: "+string);
	},
	
	/*
     * findMonthPosition: finds the ordinal position of a day within the month
     * (if timestamp is a Tuesday, will tell if it's 1st Tuesday, 2nd Tuesday, etc.)
	 * if !findPositivePosition, it will search from the end of the month
	 * param date: date to find the position of
	 * param findPositivePosition: if true, searches from the start of the month and returns a positive number.
	 *                             if false, searches from the end of the month and returns a negative number
	 * returns: an integer representing the position of the day within the month 
	 */
	//Timezone agnostic
	findMonthPosition: function(date, findPositivePosition){
		var daysApart;
		if(findPositivePosition) {
			var firstOfMonth = date.clone();
			firstOfMonth.setDate(1);
			daysApart = this.utils.howManyDaysBetweenShortRange(firstOfMonth, date);
			return Math.floor(daysApart / 7) + 1;	
		} else {
			var lastOfMonth = date.clone();
			if(this.utils.isLeapYear(lastOfMonth.getFullYear())) {
				lastOfMonth.setDate(this.utils.leapYearDaysInMonth[lastOfMonth.getMonth()]);
			} else {
				lastOfMonth.setDate(this.utils.regularYearDaysInMonth[lastOfMonth.getMonth()]);	
			}
			daysApart = this.utils.howManyDaysBetweenShortRange(date, lastOfMonth);	
			return Math.floor((daysApart / 7) + 1) * -1;	
		}	
	},

	/*
	 * getNegativeDayOfMonth: finds the day number of a day in the month, counting from the end of the month
	 * (last day = -1, second to last day = -2, etc.)
	 * param date: date to find the position of
	 * returns: an negative integer representing the position of the day within the month
	 */
	//Timezone agnostic
	getNegativeDayOfMonth: function(date){
		var lastOfMonth = date.clone();
		if (this.utils.isLeapYear(lastOfMonth.getFullYear())) {
			lastOfMonth.setDate(this.utils.leapYearDaysInMonth[lastOfMonth.getMonth()]);
		}
		else {
			lastOfMonth.setDate(this.utils.regularYearDaysInMonth[lastOfMonth.getMonth()]);
		}
		var daysApart = this.utils.howManyDaysBetweenShortRange(date, lastOfMonth);	
		return (daysApart + 1) * -1;
	},

	/*
	 * getWeekNumber: Finds the number of the week in the year. 
	 * param date: date to find the week number of
	 * returns: an integer representing the week number
	 */
	getWeekNumber: function (date){
		//From wikipedia:
		//Method: Using ISO weekday numbers (running from 1 for Monday to 7 for Sunday), 
		//subtract the weekday from the ordinal date, then add 10. 
		//Divide the result by 7. Ignore the remainder; the quotient equals the week number. 
		//If the week number thus obtained equals 0, it means that the given date belongs to the 
		//preceding (week-based) year. If a week number of 53 is obtained, one must check that 
		//the date is not actually in week 1 of the following year.
		
		var ordinalDay;
		var weekNumber;
		var weekday = date.getDay();
		
		if (weekday === 0) {
			weekday = 7;
		}
		
		if(date.getMonth() === 0){
			ordinalDay = date.getDate();
		} else if (this.utils.isLeapYear(date.getFullYear())) {
			ordinalDay = this.utils.leapYearDaysCumulative[date.getMonth() - 1] + date.getDate();
		} else { 
			ordinalDay = this.utils.regularYearDaysCumulative[date.getMonth() - 1] + date.getDate();
		}
		weekNumber = Math.floor((ordinalDay - weekday + 10) / 7);
		
		return weekNumber;
	},

	/*
	 * getNegativeWeekNumber: Finds the number of the week in the year, counting from the end of the year.
	 * (Last week of the year = -1, second to last = -2, etc.)
	 * param date: date to find the week number of
	 * returns: an integer representing the week number  
	 */
	getNegativeWeekNumber: function (date){
		var endOfYear = new Date(date.getFullYear(), 11, 31);
		var weeksInYear = this.getWeekNumber(endOfYear);
		var positiveWeekNumber = this.getWeekNumber(date);
		return (weeksInYear - positiveWeekNumber + 1) * -1;
	},


	//Repeating events:
	//a. test interval
	//b. test rules 
	//c. test exception dates 
	
	//DEBATE: How often does an event get ruled out because of exception, vs. 
	//how often can you rule something out by interval?
	//Exceptions are O(n) (I think), so how many exceptions can you test before 
	//it takes longer than calculating and testing the interval?
	//It's worth experimenting to see the most fastest test order
	// - exceptions - interval - rules
	// - interval - exceptions - rules
	// - interval - rules - exceptions
	
	//Before evaluating the BYxxx rules, find any data that is assumed based on the start date.
	
	//How the BYXXX rule tests work:
	//There is a flag object that contains two bit-flags:  
	// flags.rulesPresent tracks which BYXXX rules were listed or implied in the RRULE
	// flags.rulesTrue tracks which BYXXX rules evaluated to true for this particular date.
	//At the end, if these two bit-flags match, then the event repeats on the given date.
	
	//If you're not a crusty C programmer like me, here's how bit-flags work:
	//A bit-flag is a number.  Think of it in binary form: 00000000, where the digits are numbered right to left.
	//Each digit position in the number represents a boolean: 00000010 = position 2 is true, all others are false.
	//To set a position to true, use bitwise operators to move a 1 into that position. Set position 2 to be true:
	//	flag = 1 << 2;  00000010
	//To aggregate booleans into one bit-flag, use bitwise OR:
	//  flag = flag | 1 << 4; 00001010
   

	/*
	 * setPresentFlag: sets the rulesPresent flag to true at the specified position
	 */
	setPresentFlag: function(flags, position) {
		flags.rulesPresent = flags.rulesPresent | (1 << position);
	},

	/*
	 * setTrueFlag: sets the rulesTrue flag to true at the specified position
	 */
	setTrueFlag: function(flags, position) {
		flags.rulesTrue = flags.rulesTrue | (1 << position);
	},

	/*
	 * byMonthTest: Sets the rulesPresent flag for byMonth flag position
	 * Tests if todayDate matches the recurrence specified by rule and sets rulesTrue.
	 * param rule      a BYMONTH rule
	 * param todayDate a Date object containing the date to test
	 * param flags     an object containing two bitflags: rulesPresent and rulesTrue
	 */ 
	byMonthTest: function (rule, todayDate, flags) {
		//this.rlog("byMonthTest: "+JSON.stringify(rule)+" / "+todayDate+" / "+JSON.stringify(flags));
		var flagPosition = this.flagPositions.byMonth;
		this.setPresentFlag(flags, flagPosition);	
		var month = todayDate.getMonth() + 1; //make it 1..12
		var ruleLength = rule.ruleValue.length;
		for(var i = 0; i < ruleLength; i++) {
			var ord = rule.ruleValue[i].ord;
			//this.rlog("byMonthTest: testing: ord: "+ord+" =?= "+month);
			if(ord == month) {
				//this.rlog("byMonthTest: TRUE");
				this.setTrueFlag(flags, flagPosition);
				break;
			}
		}
	},

	/*
	 * byMonthDayTest: Sets the rulesPresent flag for byMonthDay flag position
	 * Tests if todayDate matches the recurrence specified by rule and sets rulesTrue.
	 * param rule      a BYMONTHDAY rule
	 * param todayDate a Date object containing the date to test
	 * param flags     an object containing two bitflags: rulesPresent and rulesTrue 
	 */
	byMonthDayTest: function(rule, todayDate, flags) {
		//this.rlog("byMonthDayTest: "+JSON.stringify(rule)+" / "+todayDate+" / "+JSON.stringify(flags));
		var flagPosition = this.flagPositions.byMonthDay;
		this.setPresentFlag(flags, flagPosition);
		var dayOfMonth = todayDate.getDate();
		var negativeDayOfMonth = this.getNegativeDayOfMonth(todayDate);
		var ruleLength = rule.ruleValue.length;
		for(var i = 0; i < ruleLength; i++) {
			var ord = rule.ruleValue[i].ord;
			//this.rlog("byMonthDayTest: testing: ord: "+ord+" =?= "+dayOfMonth+" or =?= "+negativeDayOfMonth);
			if(ord == dayOfMonth || ord == negativeDayOfMonth) {
				//this.rlog("byMonthDayTest: TRUE");
				this.setTrueFlag(flags, flagPosition);
				break;
			}
		}
	},

	/*
	 * byDayTest: Sets the rulesPresent flag for byDay flag position
	 * Tests if todayDate matches the recurrence specified by rule and sets rulesTrue.
	 * param rule      a BYDAY rule
	 * param todayDate a Date object containing the date to test
	 * param flags     an object containing two bitflags: rulesPresent and rulesTrue 
	 */
	byDayTest: function (rule, todayDate, flags) {
		//this.rlog("byDayTest: "+JSON.stringify(rule)+" / "+todayDate+" / "+JSON.stringify(flags));
		var flagPosition = this.flagPositions.byDay;
		this.setPresentFlag(flags, flagPosition);
		var positiveMonthPosition;
		var negativeMonthPosition;
		var monthPosition;
		var ruleLength = rule.ruleValue.length;
		for(var i = 0; i < ruleLength; i++) {
			var ord = rule.ruleValue[i].ord;
			var day = rule.ruleValue[i].day;
			//this.rlog("byDayTest: ord: "+ord+", day: "+day);
			if(ord) {
				//this.rlog("byDayTest: has ord");
				//find relevant month position of todayDate
				if(ord > 0){
					if (!positiveMonthPosition) {
						positiveMonthPosition = this.findMonthPosition(todayDate, true);
					}
					monthPosition = positiveMonthPosition;
					//this.rlog("byDayTest: has ord > 0, positiveMonthPosition: "+positiveMonthPosition);	
				} else {
					if (!negativeMonthPosition) {
						negativeMonthPosition = this.findMonthPosition(todayDate, false);
					}
					monthPosition = negativeMonthPosition;	
					//this.rlog("byDayTest: has ord <= 0, negativeMonthPosition: "+negativeMonthPosition);
				}
				//this.rlog("byDayTest: testing: ord: "+ord+" =?= "+monthPosition+" and day: "+ day+" =?= "+todayDate.getDay());
				if(ord == monthPosition && day == todayDate.getDay()) {
					this.setTrueFlag(flags, flagPosition);
					//this.rlog("byDayTest: TRUE");
					break;
				}
			}
			else if (day == todayDate.getDay()) {
				//this.rlog("byDayTest: SIMPLE TEST TRUE");
				this.setTrueFlag(flags, flagPosition);
				break;
			}
		}
	},

	/*
	 * byWeekNumberTest: Sets the rulesPresent flag for byWeekNumber flag position
	 * Tests if todayDate matches the recurrence specified by rule and sets rulesTrue.
	 * param rule      a BYWEEKNO rule
	 * param todayDate a Date object containing the date to test
	 * param flags     an object containing two bitflags: rulesPresent and rulesTrue 
	 */
	byWeekNumberTest: function(rule, todayDate, flags) {
		//this.rlog("byWeekNumberTest: "+JSON.stringify(rule)+" / "+todayDate+" / "+JSON.stringify(flags));
		var flagPosition = this.flagPositions.byWeekNumber;
		this.setPresentFlag(flags, flagPosition);
		
		var weekNumber = this.getWeekNumber(todayDate);
		var negativeWeekNumber = this.getNegativeWeekNumber(todayDate);
		var ruleLength = rule.ruleValue.length;
		for(var i = 0; i < ruleLength; i++) {
			var ord = rule.ruleValue[i].ord;
			//this.rlog("byWeekNumberTest: testing: ord: "+ord+" =?= "+weekNumber+" or =?= "+negativeWeekNumber);
			if(ord == weekNumber || ord == negativeWeekNumber) {
				this.setTrueFlag(flags, flagPosition);
				//this.rlog("byWeekNumberTest: TRUE");
				break;
			}
		}
	},
	
	/*
	 * byYearDayTest: Sets the rulesPresent flag for byYearDay flag position
	 * Tests if todayDate matches the recurrence specified by rule and sets rulesTrue.
	 * param rule      a BYYEARDAY rule
	 * param todayDate a Date object containing the date to test
	 * param flags     an object containing two bitflags: rulesPresent and rulesTrue 
	 */
	byYearDayTest: function(rule, todayDate, flags) {
		//this.rlog("byYearDayTest: "+JSON.stringify(rule)+" / "+todayDate+" / "+JSON.stringify(flags));
		var flagPosition = this.flagPositions.byYearDay;
		this.setPresentFlag(flags, flagPosition);
		var yearDayNumber = this.utils.howManyDaysSinceJanuaryFirst(todayDate) + 1;
		var negativeYearDayNumber = (this.utils.howManyDaysTillDecember31(todayDate) + 1) * -1;
		var ruleLength = rule.ruleValue.length;
		for(var i = 0; i < ruleLength; i++) {
			var ord = rule.ruleValue[i].ord;
			//this.rlog("byYearDayTest: testing: ord: "+ord+" =?= "+yearDayNumber+" or =?= "+negativeYearDayNumber);
			if(ord == yearDayNumber || ord == negativeYearDayNumber) {
				this.setTrueFlag(flags, flagPosition);
				//this.rlog("byYearDayTest: TRUE");
				break;
			}
		}		
	},
	
	dateComponentsEqual: function(date1, date2){
		return ((date1.getFullYear() === date2.getFullYear()) &&
			(date1.getMonth() === date2.getMonth()) &&
			(date1.getDate() === date2.getDate()));
	},	
	/*
	 * Notes on exdates:
	 * Exdates can be in three formats: date, date-time (may include a timezone), and utc date-time.
	 *     EXDATE;VALUE=DATE:20090821,20090915
	 *     EXDATE:20090821T080000Z,20090915T080000Z
	 *     EXDATE;TZID=America/New_York:19970714T133000,20090821T080000,20090915T080000
	 * If exdates have a time component, it is usually set to the start time of the event.
	 * 
	 * Thoughts:
	 * For evaluation, technically we should be evaluating the exdates after we evaluate the rest of the rule, but
	 * I think, performance wise, it might be faster to evaluate this first.
	 * 
	 * It would be nice if the list were sorted, so that once we hit an exdate later than the test date, we can exit early.
	 * But since they're stored as strings, they would be sorted alphabetically.  If we had a mix of formats (UTC & not UTC), 
	 * this wouldn't necessarily work, because of the UTC conversion.  So for now, we iterate over the whole list.
	 */	
	
	/*
	 * evaluateExceptions: tests if todayDate is in the exceptions list
	 * param date: the timestamp indicating the date to test
	 * param eventStart: the original start time of the event
	 * param exdates: list of exceptions
	 * param tzId: timezone of the event
	 * returns: true if todayDate is in the exception list
	 */
	evaluateExceptions: function(date, exdates, eventStart, tzId) {
		var testDate = new Date(date);
		var testYear = testDate.getFullYear();
		var testMonth = testDate.getMonth() + 1;
		var testDay = testDate.getDate();
		var exdatesLength = exdates ? exdates.length : 0;

		// webOS CE: an exception names a day of the event's zone, and date is that day's label, so
		// only the calendar date is compared. The time in an exception adds nothing: a repeat
		// happens at most once a day here. A UTC exception is first read in the event's zone.
		for (var i = 0; i < exdatesLength; i++) {
			var exdate = exdates[i];
			var year = parseInt(exdate.substr(0, 4), 10);
			var month = parseInt(exdate.substr(4, 2), 10);
			var day = parseInt(exdate.substr(6, 2), 10);

			if (exdate.length === 16) {
				var timezoneManager = new TimezoneManager();
				var instant = Date.UTC(year, month - 1, day, parseInt(exdate.substr(9, 2), 10), parseInt(exdate.substr(11, 2), 10), parseInt(exdate.substr(13, 2), 10));
				var clock = new Date(instant + timezoneManager.getOffset(new Date(instant).getFullYear(), tzId, instant / 1000) * 1000);
				year = clock.getUTCFullYear();
				month = clock.getUTCMonth() + 1;
				day = clock.getUTCDate();
			}
			else if (exdate.length !== 8 && exdate.length !== 15) {
				continue;		//malformed. can't evaluate
			}

			if (year === testYear && month === testMonth && day === testDay) {
				return true;
			}
		}
		return false;
	},

	/*
	 * evaluateRules: Iterates through the array of rules and evaluates each, setting results in the appropriate bitflags
	 * param rules     an array of BYxxx rules
	 * param todayDate a Date object containing the date to test
	 * param flags     an object containing two bitflags: rulesPresent and rulesTrue 
	 */
	//TODO: Do we want to actively reject malformed rules?  If so, add some enforcement about the 
	//frequency type vs. the BYxxx rules we got.
	evaluateRules: function(rules, todayDate, flags) {
	
		//this.rlog("evaluateRules: "+JSON.stringify(rules));
		for(var i = 0; i < rules.length; i++) {
				
			var rule = rules[i];		
			switch(rule.ruleType) {
				case "BYMONTH": //[1..12]
					this.byMonthTest(rule, todayDate, flags);
					break;
			
				case "BYWEEKNO":	//[-53..-1,1..53]
					this.byWeekNumberTest(rule, todayDate, flags);
					break;
						
				case "BYMONTHDAY": //[-31..-1,1..31]         
					this.byMonthDayTest(rule, todayDate, flags);
					break;
				
				case "BYDAY": //[MO|WE,3MO,2WE,-3WE,-1FR]
					this.byDayTest(rule, todayDate, flags);
					break;
				
				case "BYYEARDAY":
					this.byYearDayTest(rule, todayDate, flags);
					break;	
			}	
		}
	},

	/*
	 * frequencyTypeDaily: tests an rrule whose frequency=DAILY
	 * param today       timestamp representing the date to be tested
	 * param eventStart  timestamp representing the start date/time of the first occurrence of the event
	 * param rrule       rrule object whose frequency=DAILY
	 * Returns true if this event repeats on today.
	 */
	frequencyTypeDaily: function(today, eventStart, rrule) {
		//this.rlog("Frequency daily: rule: "+JSON.stringify(rrule));
		var flags = {"rulesPresent": 0, "rulesTrue": 0};
		var todayDate = new Date(today);
		var eventStartDate = new Date(eventStart);  
		
		if (!rrule.interval) {
			rrule.interval = 1;
		}
		
		//Interval test
		if(rrule.interval !== 1) {
			var days = this.utils.howManyDaysBetween(eventStartDate, todayDate);
			if (days % rrule.interval !== 0) {
				//this.rlog("Frequency daily: failed interval check");
				return false;
			}
		}

		//Rule tests
		if (rrule.rules && rrule.rules.length > 0) {
			this.evaluateRules(rrule.rules, todayDate, flags);
		}
		
		//this.rlog("Frequency daily: "+(flags.rulesPresent == flags.rulesTrue));		
		return (flags.rulesPresent == flags.rulesTrue);
	},

	/*
	 * frequencyTypeWeekly: tests an rrule whose frequency=WEEKLY
	 * param today       timestamp representing the date to be tested
	 * param eventStart  timestamp representing the start date/time of the first occurrence of the event
	 * param rrule       rrule object whose frequency=WEEKLY
	 * Returns true if this event repeats on today.
	 */
	frequencyTypeWeekly: function(today, eventStart, rrule){
		//this.rlog("Frequency weekly: rule: "+JSON.stringify(rrule));
		var flags = {"rulesPresent": 0, "rulesTrue": 0};
		var todayDate = new Date(today);
		var eventStartDate = new Date(eventStart);
		var defaultRule = {"ruleType":"BYDAY", "ruleValue": [{"day": eventStartDate.getDay()}]};
		var hasByDayRule = false;	
				
		if (!rrule.interval) {
			rrule.interval = 1;
		}
				
		//Interval test
		if (rrule.interval !== 1) {
			var weeks = this.utils.howManyWeeksBetween(eventStartDate, todayDate);
			if (weeks % rrule.interval !== 0) {	
				//this.rlog("Frequency weekly: failed interval check");		
				return false;
			}
		}
		
		//What data to we have?  Do we have a day of week to repeat on?
		//Figure out if the day of week was specified
		if(rrule.rules && rrule.rules.length > 0){
			for(var i = 0; i < rrule.rules.length; i++){
				if (rrule.rules[i].ruleType == "BYDAY") {
					hasByDayRule = true;
				}
			}
		}
		
		//Fill in anything missing
		//if we're missing which day of the week to repeat on, get it from the start date			
		if (rrule.rules && !hasByDayRule) {
			rrule.rules.push(defaultRule);
			//this.rlog("Frequency weekly: adding additional default rule");
		}
		else if (!rrule.rules) {
			rrule.rules = [defaultRule];
			//this.rlog("Frequency weekly: no rules, adding default rule");
		}
						
		//Rule tests
		this.evaluateRules(rrule.rules, todayDate, flags);
		
		//this.rlog("Frequency daily: "+(flags.rulesPresent == flags.rulesTrue));			
		return (flags.rulesPresent == flags.rulesTrue);
	},

	/*
	 * frequencyTypeMonthly: tests an rrule whose frequency=MONTHLY
	 * param today       timestamp representing the date to be tested
	 * param eventStart  timestamp representing the start date/time of the first occurrence of the event
	 * param rrule       rrule object whose frequency=MONTHLY
	 * Returns true if this event repeats on today.
	 */
	frequencyTypeMonthly: function(today, eventStart, rrule){
		//this.rlog("Frequency monthly: rule: "+JSON.stringify(rrule));
		var flags = {"rulesPresent": 0, "rulesTrue": 0};
		var hasByDayRule = false;
		var hasByMonthDayRule = false;
		var todayDate = new Date(today);
		var eventStartDate = new Date(eventStart);
		var defaultRule = {"ruleType":"BYMONTHDAY", "ruleValue": [{"ord": eventStartDate.getDate()}]};
	
		if (!rrule.interval) {
			rrule.interval = 1;
		}
		
		//Interval test
		if(rrule.interval != 1) {
			var months = this.utils.howManyMonthsBetween(eventStartDate, todayDate);
			if (months % rrule.interval !== 0) {
				//this.rlog("Frequency monthly: failed interval check");	
				return false;
			}
		}
	
		//What data to we have? Do we have a date or day of month to repeat?
		if(rrule.rules && rrule.rules.length > 0) {
			for(var i = 0; i < rrule.rules.length; i++){
				if (rrule.rules[i].ruleType == "BYDAY") {
					hasByDayRule = true;
				}
				if (rrule.rules[i].ruleType == "BYMONTHDAY") {
					hasByMonthDayRule = true;
				}
			}
		}
	
		//Fill in anything missing	
		//if we're missing which day of the month to repeat on, get it from the start date			
		if (rrule.rules && !hasByDayRule && !hasByMonthDayRule) {
			//this.rlog("Frequency monthly: adding default rule");
			rrule.rules.push(defaultRule);
		}
		else if (!rrule.rules) {
			//this.rlog("Frequency monthly: no rules, adding default rule");			
			rrule.rules = [defaultRule];
		}	
			
		//Rule tests
		this.evaluateRules(rrule.rules, todayDate, flags);
		
		//this.rlog("Frequency monthly: "+(flags.rulesPresent == flags.rulesTrue));			
		return (flags.rulesPresent == flags.rulesTrue);
	},

	/*
	 * frequencyTypeYearly: tests an rrule whose frequency=YEARLY
	 * param today       timestamp representing the date to be tested
	 * param eventStart  timestamp representing the start date/time of the first occurrence of the event
	 * param rrule       rrule object whose frequency=YEARLY
	 * Returns true if this event repeats on today.
	 */
	frequencyTypeYearly: function (today, eventStart, rrule){
		//this.rlog("Frequency yearly: rule: "+JSON.stringify(rrule));
		var flags = {"rulesPresent": 0, "rulesTrue": 0};
		
		var todayDate = new Date(today);
		var eventStartDate = new Date(eventStart);
		
		if (!rrule.interval) {
			rrule.interval = 1;
		}
		
		//Interval test
		if(rrule.interval !== 1) {
			var years = todayDate.getFullYear() - eventStartDate.getFullYear();
			if (years % rrule.interval !== 0) {
				//this.rlog("Frequency yearly: failed interval check");
				return false;
			}
		}
		
		//if we have no rules, add bymonth and bymonthday
		if(!rrule.rules || rrule.rules.length === 0) {
			//if no rules - need bymonthday=date, bymonth=month
			rrule.rules = [
				{	"ruleType":"BYMONTH"
				,	"ruleValue":[{"ord":eventStartDate.getMonth()+1}]
				}, 
				{	"ruleType":"BYMONTHDAY"
				,	"ruleValue":[{"ord": eventStartDate.getDate()}]
				}
			];
			//this.rlog("Frequency yearly: no rules, adding default rule");
		}
		
		//figure out what rules we have
		for(var i = 0; i < rrule.rules.length; i++) {
			var rule = rrule.rules[i];
			if (rule.ruleType == "BYMONTH") {				
				this.setPresentFlag(flags, this.flagPositions.byMonth);
			}
			else if (rule.ruleType == "BYMONTHDAY") {
				this.setPresentFlag(flags, this.flagPositions.byMonthDay);
			}
			else if (rule.ruleType == "BYDAY") {
				this.setPresentFlag(flags, this.flagPositions.byDay);
			}
			else if (rule.ruleType == "BYWEEKNO") {
				this.setPresentFlag(flags, this.flagPositions.byWeekNumber);
			}
			else if (rule.ruleType == "BYYEARDAY") {
				this.setPresentFlag(flags, this.flagPositions.byYearDay);
			}
		}
		
		//this.rlog("Frequency yearly: processed what rules we have: "+flags.rulesPresent);
		
		//Check for compatible flag combinations: byYearDay, byWeekNo && byDay, byMonth && byMonthDay
		//if we have something else, then we need to take data from the start date	
		//have month, but no byDay and no byMonthDay
		if((flags.rulesPresent & this.hasRules.byMonth) && (!(flags.rulesPresent & this.hasRules.byDay) && !(flags.rulesPresent & this.hasRules.byMonthDay))){
			rrule.rules.push({"ruleType": "BYMONTHDAY", "ruleValue": [{"ord": eventStartDate.getDate()}]});
			//this.rlog("Frequency yearly: adding BYMONTHDAY RULE");
		}
	
		//have month day but no month
		if(!(flags.rulesPresent & this.hasRules.byMonth) && (flags.rulesPresent & this.hasRules.byMonthDay)){
			rrule.rules.push({"ruleType":"BYMONTH", "ruleValue": [{"ord": eventStartDate.getMonth()+1}]});
			//this.rlog("Frequency yearly: adding BYMONTH RULE");
		}
		
		//have week number but no weekday
		if((flags.rulesPresent & this.hasRules.byWeekNumber) && !(flags.rulesPresent & this.hasRules.byDay)){ 
			//add weekday
			rrule.rules.push({"ruleType":"BYDAY", "ruleValue": [{"day":eventStartDate.getDay()}]});
			//this.rlog("Frequency yearly: adding BYDAY RULE");	
		}
		
		//Rule tests
		this.evaluateRules(rrule.rules, todayDate, flags);
		
		//this.rlog("Frequency yearly: "+(flags.rulesPresent == flags.rulesTrue));
		return (flags.rulesPresent == flags.rulesTrue);
	},

	/*
	 * evaluateRRule: tests a recurring event to see if it repeats on the specified date	
	 * param date: date to test, assumed to be in the event's timezone
	 * param eventStart: event's segment start time
	 * param eventsOriginalStart: event's original start time
	 * param rrule: the rrule to evaluate
	 * param exdates: the event's exception dates
	 * param eventTzID: timezone id of the event, for use with exdates
	 * returns: true if the event repeats on the specified date
	 *			false if the event doesn't repeat on the specified date
	 *			-1 if the date is an EXDATE
	 */	
	evaluateRRule: function(date, eventStart, eventOriginalStart, rrule, exdates, eventTzID, countInfo){
		// webOS CE: date is a day label, and until is real time, so this can only rule out a date
		// that's clearly past it. The caller tests the occurrence's real start against until.
		var margin = 172800000;
		if(rrule.until && rrule.until + margin < date){
			return false;
		}
		else if(countInfo &&
				((countInfo.until && countInfo.until + margin < date) ||
				 (countInfo.estimateEnd && countInfo.estimateEnd + margin < date))
			   ){
			return false;
		}

		var repeatsOnDate;
		switch (rrule.freq) {
			case "DAILY":
				repeatsOnDate = this.frequencyTypeDaily(date, eventStart, rrule);
				break;
			case "WEEKLY":
				repeatsOnDate = this.frequencyTypeWeekly(date, eventStart, rrule);
				break;
			case "MONTHLY":
				repeatsOnDate = this.frequencyTypeMonthly(date, eventStart, rrule);
				break;
			case "YEARLY":
				repeatsOnDate = this.frequencyTypeYearly(date, eventStart, rrule);
				break;
			default:
				repeatsOnDate = false;
		}

		// webOS CE: only an actual occurrence can be an exception. An exception on some other date
		// mustn't use up a count, or hide anything.
		if(repeatsOnDate && exdates && this.evaluateExceptions(date, exdates, eventOriginalStart, eventTzID)){
			//An exception counts as an occurrence for count-based repeat, so don't return false.
			//But don't return true either, because it shouldn't be shown.
			return -1;
		}

		return repeatsOnDate;
	}

};

exports.RRuleManager = RRuleManager;


//@ sourceURL=calendar/event-manager.js

/* Copyright 2010 Palm, Inc.  All rights reserved. */

/*
 * DateRange
 * {	Date	start
 * ,	Date	end
 * ,	String	tzId
 * ,	String	calendarId
 * ,	Object	excludeList
 * }
 */

/*jslint browser:true, devel:true, laxbreak:true, white:false */
/*global _, Class, DB, exports, EventManager:true, Future, Foundations, ObjectUtils, RRuleManager, TimezoneManager, PalmCall */

//------------------------------------------------------------------------------------
var EventManagerUtils = Class.create ({
	
	/** Performance Notes:
	 * - Month View is slowed 60% by findRepeatsInRange().
	 * - Month View is slowed 40% by getEventRenderTimes().
	 */

	initialize: function(){
		this.timezoneManager= new TimezoneManager();
		this.rruleManager	= new RRuleManager();
		this.noOccurrences	= [];
	},
	
	logLevels:  
	{
		repeatDetails	: 0x00000001,
		dateDetails		: 0x00000010,
		responses		: 0x00000100,
		singleEvents	: 0x00001000,
		renderTimes		: 0x00010000,
		tzLoading		: 0x00100000,
		getBusyDays		: 0x01000000,
		timeout			: 0x10000000,
		all				: 0x11111111
	},
		
	evlog: function(level, string){
//		this.logging = true;
//		var filterLevel = this.logLevels.all;
//		if((filterLevel & level) > 0){
//			console.info("========== eventmgr: "+string);	
//		}		
	},

	getGEIRTimeLimit: function(){
		return this.GEIRTimeLimit;
	},
	
	setGEIRTimeLimit: function(val){
		this.GEIRTimeLimit = val;
	},

	sortByStartTime: function(a, b){
		return a.renderStartTime - b.renderStartTime;
	},

	/*
	 * Loops through the eventSet and finds each unique timezone id listed, and loads
	 * then prompts the timezone manager to load those timezones.  It's assumed that this
	 * will happen on boot when we do the initial query for all events, and that's when the
	 * bulk of the timezone info will be acquired, so we shouldn't have to wait very often for
	 * timezone manager service calls to come back.
	 */
	loadTimezones: function(eventSet){
		//this.evlog(this.logLevels.tzLoading, "In loadTimezones");
		if(!eventSet || eventSet.length === 0){
			return;
		}			
				
		var tzIds = this.getUniqueTzIdsInEventSet(eventSet);
		//this.evlog(this.logLevels.tzLoading, "loadTimezones: tzIds: "+JSON.stringify(tzIds));

		var future = this.timezoneManager.setup();

		future.then(this, function(){
			var result = future.result;
			future.result = this.timezoneManager.loadTimezones(tzIds, this.getStartYears(eventSet));
		});

		return future;
	},
	
	/*
	 * Given a range, finds all the years included between range.start
	 * and range.end, and returns an array of years.  For use in conjunction
	 * with timezone manager requests.
	 */
	getYearsInRange: function(range){
		var timeMachine = new Date();
		if(!range){
			var currentYear = timeMachine.getFullYear();
			//this.evlog(this.logLevels.tzLoading, "getYearsInRange: using current year: "+ currentYear);
			return [currentYear]; 
		}
		
		timeMachine.setTime(range.start);
		var rangeStartYear = timeMachine.getFullYear();
		
		timeMachine.setTime(range.end);
		var rangeEndYear = timeMachine.getFullYear();
		//this.evlog(this.logLevels.tzLoading, "getYearsInRange: range: "+ rangeStartYear + " - " + rangeEndYear);
				
		if(rangeStartYear === rangeEndYear){
			return [rangeStartYear];
		}
		
		var years = [];		
		for(var i = rangeStartYear; i <= rangeEndYear; i++){
			years.push(i);
		}
		
		//this.evlog(this.logLevels.tzLoading, "getYearsInRange: years: "+ JSON.stringify(years));
		return years;
	},
	
	/*
	 * Given an event set, finds each unique timezone id in the set
	 * and returns an array of timezone ids.
	 */
	getUniqueTzIdsInEventSet: function(eventSet){
		var temp = [];
		var tzIds = [];
		var eventsLength = eventSet.length;
		for(var i = 0; i < eventsLength; i++){
			var event = eventSet[i];
			var tzId = event.tzId;
			if(tzId && !temp[tzId]){
				tzIds.push(tzId);
				temp[tzId] = true;
			}
		}
		//this.evlog(this.logLevels.tzLoading, "getUniqueTzIdsInEventSet: tzIds: "+ JSON.stringify(tzIds));
		return tzIds;
	},
			
	/*
	 * occursInRange: tests non-recurring events to see if they occur within the specified range 
	 * @param event: a non-recurring event
	 * @param range: a date range object. Start and end of range is expected to be in device local time.
	 * @returns: true if the event does occur during the specified range
	 */
	occursInRange: function(event, range){

		var eventOccurs = false;
		var startRangeTz = range.start;
		var endRangeTz = range.end;

		//For non-repeating events, the current occurrence is the only occurrence,
		//and a timestamp is a timestamp.
		event.currentLocalStart = event.dtstart;
		event.currentLocalEnd = event.dtend;
		
		//this.evlog(this.logLevels.singleEvents, "occursInRange: range: "+new Date(range.start) + " - " + new Date(range.end));
		//this.evlog(this.logLevels.singleEvents, "occursInRange: event: "+new Date(event.currentLocalStart) + " - " + new Date(event.currentLocalEnd));
		
		//if this event ends at midnight, back it up to 23:59:59
		var startTime = new Date(event.currentLocalStart);
		var endTime = new Date(event.currentLocalEnd);
		//If it's a zero-time event, or some weird hours, don't do anything, it will show up as one day.
		//But if it's not a zero-time event, and it ends at midnight, we need to trim that last second off.
		var isZeroTime = (startTime.compareTo(endTime) === 0);
		if(!isZeroTime && endTime.getHours() === 0 && endTime.getMinutes() === 0 && endTime.getSeconds() === 0){
			event.currentLocalEnd = event.currentLocalEnd - 1000;
			//this.evlog(this.logLevels.singleEvents, "occursInRange: adjusted end time for all-day/midnight-ending event");
		}
		
		if (event.currentLocalEnd >= startRangeTz && event.currentLocalStart < endRangeTz) {
			//this.evlog(this.logLevels.singleEvents, "occursInRange: event occurs within range");
			eventOccurs = true;
		}

		return eventOccurs;
	},
	
	repeatEndedBeforeDate: function(rrule, countInfo, date){
		if((rrule && rrule.until && rrule.until < date) || 
			(countInfo && ((countInfo.until && countInfo.until < date) || (countInfo.estimateEnd && countInfo.estimateEnd < date)))){
			//this.evlog(this.logLevels.repeatDetails, "repeatEndedBeforeDate: true");
			return true;
		}
		return false;	
	},
	
	estimateRepeatEnd: function(event){
		var freq = event.rrule.freq;
		var interval = parseInt(event.rrule.interval, 10) || 1; //convert to number from string otherwise this will get concatenated as string
		var count = parseInt(event.rrule.count, 10);
		var bonusPadding = 3;  //This is random, we're being generous in our estimate
		var base;
		var timeMachine = new Date(event.dtstart);
		switch(freq){
			case "DAILY":
				base = 1;
				break;
			case "WEEKLY":
				base = 7;
				break;
			case "MONTHLY":
				base = 31;
				if(timeMachine.getDate() == 31){  //Is this repeating 31st of the month?
					base = base * 2;
				}
				break;
			case "YEARLY":
				base = 366;
				if(timeMachine.getMonth() == 1 && timeMachine.getDate() == 29){  //Is this feb 29?
					base = base * 4;
				}
				break;
		}
				
		var daysRepeatCycleSpans = base * interval * (count + bonusPadding);
		timeMachine.addDays(daysRepeatCycleSpans);
		//this.evlog(this.logLevels.repeatDetails, "Estimated end date: "+timeMachine);		
		return timeMachine.getTime();
	},
	
	countPrep: function countPrep(event){
		var countInfo = event.countInfo;
		
		if(!countInfo){
			event.countInfo = {};
			countInfo = event.countInfo;
		}
		
		//get a worst-case ballpark end time
		if(!countInfo.estimateEnd){
			countInfo.estimateEnd = this.estimateRepeatEnd(event);				
		}
	},
	
	basicRangeTests: function basicRangeTests (event, range){
		//Before we do any real work, if our event didn't start until 48 hours after the range ends, we're not even bothering.
		//We picked 48 hours because that should be more than enough to account for any timezone and DST shifting issues.
		if(event.dtstart > (range.end+172800000)){
			//this.evlog(this.logLevels.repeatDetails, "basicRangeTests: nowhere close, event hasn't started yet");
			return false;
		}

		if(event.rrule && event.rrule.count){
			if(!event.countInfo){
				this.countPrep(event);	
			}
			if(event.countInfo.estimateEnd < range.start){
				//this.evlog(this.logLevels.repeatDetails, "basicRangeTests: exit: estimated end is before range starts");
				return false;
			}
		}
		//Similarly, if our event ended at least 48 hours before the range started, we're not even bothering.
		else if(event.rrule && event.rrule.until){
			if (event.rrule.until < (range.start - 172800000)) {
				//this.evlog(this.logLevels.repeatDetails, "basicRangeTests: nowhere close, event already ended");
				return false;
			}
		}	
		return true;
	},
	
	allDayAdjustment: function allDayAdjustment(start, end, timeMachine){
		//some special handling for all day events.  If it's listed as midnight to midnight,
		//our getDatesInRange will show it on two dates, when it's really only one.
		//So we need to trim that last second off before finding dates in the event.
		if(!timeMachine){
			timeMachine = new Date();
		}
		
		var startTime = timeMachine.setTime(start);
		var endTime = timeMachine.setTime(end);
		var endDate = timeMachine;
			
		//If it's a zero-time event or some weird hours, don't do anything, it will show up as one day.
		//But if it's not a zero-time event, and it ends at midnight, we need to trim that last second off
		//before we go figure out the dates in the event.
		var isZeroTime = (startTime == endTime);
		if(!isZeroTime && endDate.getHours() === 0 && endDate.getMinutes() === 0 && endDate.getSeconds() === 0){
			end = end - 1000;
			//this.evlog(this.logLevels.repeatDetails, "allDayAdjustment: adjusting for allday event");
		}
		return end;
	},
	
			
	/*
	 * findRepeatsInRange: finds all occurrences of an event within the specified range.
	 * @param event: the event to find the recurrences of
	 * @param range: the range in which to find the recurrences. Range is assumed to be in the device's local time
	 * @param limit: optional. number of results to limit the response to.
	 * @returns: an array of events.  Each event will be a copy of the original, but with the current occurrences' local and tz times set. 
	 */
	/*
	 * webOS CE: repeats are worked out as dates in the event's zone. Three kinds of value are in
	 * play here, and nothing below converts between them except these functions:
	 *   instant: real time, a timestamp. dtstart, dtend and the occurrences are these.
	 *   wall:    a clock reading in a zone, held in UTC fields so that it can't be read as local
	 *            time by mistake. Only ever made by wallClockOf and undone by wallToInstant.
	 *   date:    a day label, midnight of that calendar date on the device's clock. It says which
	 *            day, as RRuleManager expects, and is never a moment.
	 * Offsets come only from TimezoneManager.getOffset.
	 */
	getStartYears: function getStartYears(eventSet){
		// webOS CE: an old repeat needs the rules of the year it started in, which the range doesn't.
		var years = [], seen = {}, year;
		for(var i = 0; i < eventSet.length; i++){
			if(eventSet[i].rrule && isFinite(eventSet[i].dtstart)){
				year = new Date(eventSet[i].dtstart).getFullYear();
				if(!seen[year]){
					seen[year] = true;
					years.push(year);
				}
			}
		}
		return years;
	},

	offsetAt: function offsetAt(instant, tzId){
		var timezoneManager = this.timezoneManager;
		return timezoneManager.getOffset(new Date(instant).getFullYear(), tzId || timezoneManager.getSystemTimezone(), instant / 1000) * 1000;
	},

	wallClockOf: function wallClockOf(instant, tzId){
		return instant + this.offsetAt(instant, tzId);
	},

	/*
	 * A clock reading the zone skips, in a spring change, takes the offset from before the change.
	 * One it repeats, in an autumn change, means the first time round. Both as in RFC 5545.
	 */
	wallToInstant: function wallToInstant(wall, tzId){
		var before = this.offsetAt(wall - 86400000, tzId)
		,	after = this.offsetAt(wall + 86400000, tzId)
		,	first = wall - before
		,	second = wall - after
		,	firstValid
		,	secondValid
		;
		if(before === after){
			return first;
		}
		firstValid = (this.offsetAt(first, tzId) === before);
		secondValid = (this.offsetAt(second, tzId) === after);
		if(firstValid && secondValid){
			return Math.min(first, second);
		}
		return (secondValid && !firstValid) ? second : first;
	},

	dateOfWall: function dateOfWall(wall){
		var clock = new Date(wall);
		return new Date(clock.getUTCFullYear(), clock.getUTCMonth(), clock.getUTCDate()).getTime();
	},

	nextDate: function nextDate(date){
		var day = new Date(date);
		return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
	},

	timeOfDay: function timeOfDay(wall){
		var clock = new Date(wall);
		return Date.UTC(1970, 0, 1, clock.getUTCHours(), clock.getUTCMinutes(), clock.getUTCSeconds());
	},

	occurrenceStart: function occurrenceStart(date, timeOfDay, tzId){
		var day = new Date(date);
		return this.wallToInstant(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) + timeOfDay, tzId);
	},

	/*
	 * until has two forms. 23:59:59 on the device's clock is the whole of a date in the event's
	 * zone, which is what an all-day repeat and an import store. Anything else is a real moment,
	 * and the last occurrence is the last to start by then.
	 */
	untilPassed: function untilPassed(until, date, start){
		var limit = new Date(until);
		if(limit.getHours() === 23 && limit.getMinutes() === 59 && limit.getSeconds() === 59){
			return date > until;
		}
		return start > until;
	},

	makeOccurrence: function makeOccurrence(event, start, end){
		var countInfo = event.countInfo
		,	occurrence
		,	timeMachine = new Date()
		,	first
		,	start12AM
		,	last
		,	end12AM
		;
		delete event.countInfo;
		occurrence = ObjectUtils.clone (event);
		countInfo && (event.countInfo = countInfo);

		occurrence.currentLocalStart = start;
		occurrence.currentLocalEnd = end;
		// If this is a non-zero length allday event, and it ends at midnight, back it up to 23:59:59:
		if(occurrence.allDay) {
			first		= timeMachine.setTime	(start);
			start12AM	= timeMachine.clearTime	().getTime();
			last		= timeMachine.setTime	(end);
			end12AM		= timeMachine.clearTime	().getTime();

			if ((first !== last) && (last === end12AM) && (first === start12AM)) {
				occurrence.currentLocalEnd -= 1000;
			}
		}
		return occurrence;
	},

	findRepeatsInRange: function(event, range, limit){
		//Broad view of what's going on here:
		//RRULE evaluation works by whole dates in the event's timezone, so we turn the local range into
		//the dates it covers there. For each date, test if the event repeats on it. When it does, the
		//occurrence's start is that date at the event's clock time, converted to real time.
		//If the event spans across days, it's possible it started earlier and spans into the range,
		//so scoot the beginning of the search back by the number of days the event spans.

		//Test against the range. Maybe we don't repeat anywhere near this range, and don't have to do any work
		var keepGoing = this.basicRangeTests(event, range);
		if(!keepGoing){
			return this.noOccurrences;
		}

		// Single Date object to be reused for calculating multiple time (ms)
		// instances rather than expensively creating multiple Date instances.
		var timeMachine = new Date();

		//Start and end timestamps we can adjust without altering the original event
		var tempStart = event.dtstart;
		var tempEnd = event.dtend;

		//All-day events that are midnight-to-midnight need some adjustment
		if(event.allDay){
			tempEnd = this.allDayAdjustment(tempStart, tempEnd, timeMachine);
		}

		//If the event spans across at least one midnight, we need to back up the beginning of the search range by
		//the number of days spanned
		var datesInEvent = this.getDatesInRange({start: tempStart, end: tempEnd, tzId: event.tzId});
		var additionalRangeDaysNeeded = (datesInEvent.length - 1);
		var searchRange = range;
		if(additionalRangeDaysNeeded){
			searchRange = Foundations.ObjectUtils.clone(range);
			timeMachine.setTime(range.start);
			timeMachine.addDays(-additionalRangeDaysNeeded);
			searchRange.start = timeMachine.getTime();
			searchRange.end = range.end;
			//remove any existing datesInRange on this range, since we just changed its value
			searchRange.datesInRange = undefined;
		}

		//datesInRange holds dates in the event's zone. We calculate this once for each range/tzId and cache it on the searchRange
		var datesInRange;
		if(!searchRange.datesInRange){
			searchRange.datesInRange = {};
		}

		if(!searchRange.datesInRange[event.tzId]){
			datesInRange = this.getDatesInRange({start: searchRange.start, end: searchRange.end, tzId: event.tzId});
		}
		else{
			datesInRange = searchRange.datesInRange[event.tzId];
		}
		searchRange.datesInRange[event.tzId] = datesInRange;

		//Now that we know more about the search range, test again:
		//Has the event's repeat cycle even started yet?  Did its repeat cycle already end?
		if(event.dtstart > searchRange.end || this.repeatEndedBeforeDate(event.rrule, event.countInfo, searchRange.start)){
			return this.noOccurrences;
		}

		return this.findRepeatsInRangeHelper(event, range, datesInRange, datesInEvent, limit);
	},
	
	
	/*
	 * findRepeatsInRangeCountVersion: finds all occurrences of a count-based repeating event within the specified range.
	 * @param event: the event to find the recurrences of
	 * @param range: the range in which to find the recurrences. Range is assumed to be in the device's local time
	 * @returns: an array of events.  Each event will be a copy of the original, but with the current occurrences' local and tz times set. 
	 */
	findRepeatsInRangeCountVersion: function(event, range){
		//See findRepeatsInRange for a full explanation of the process.

		//A count has to be worked from the first occurrence, as the count includes every one before
		//the range. The countInfo object keeps that work so each search carries on where the last stopped.
		//It only lives on the local copy of the event, not in the database:
		// countInfo: {
		//		estimateEnd: timestamp - estimate of when the repeat cycle for this event will end
		//		occurrences: [start1, start2, ...] - the real start of each occurrence found so far.
		//		nextDate: the next date to test, a date in the event's zone
		//		used: how much of the count has gone. Exceptions use it up, but aren't occurrences.
		// }

		//Test against the range. Maybe we don't repeat anywhere near this range, and don't have to do any work
		var keepGoing = this.basicRangeTests(event, range);
		if(!keepGoing){
			return this.noOccurrences;
		}

		var tempEnd = event.dtend;

		// Single Date object to be reused for calculating multiple time (ms)
		// instances rather than expensively creating multiple Date instances.
		var timeMachine = new Date();

		//All-day events that are midnight-to-midnight need some adjustment
		if(event.allDay){
			tempEnd = this.allDayAdjustment(event.dtstart, tempEnd, timeMachine);
		}

		var datesInEvent = this.getDatesInRange({start: event.dtstart, end: tempEnd, tzId: event.tzId});

		if(!event.countInfo){
			console.error("===== Yikes, something is wrong, your countInfo disappeared for event: "+event._id);
			this.countPrep(event);
		}
		var countInfo = event.countInfo;
		if(!countInfo.occurrences){
			countInfo.occurrences = [];
			countInfo.nextDate = datesInEvent[0];
			countInfo.used = 0;
		}

		var count = parseInt(event.rrule.count, 10) || 1;
		var lastDate = this.dateOfWall(this.wallClockOf(range.end, event.tzId));
		var startClock = this.timeOfDay(this.wallClockOf(event.dtstart, event.tzId));
		var date;
		var repeats;
		while(countInfo.used < count && countInfo.nextDate <= lastDate){
			var timeLimit = this.getGEIRTimeLimit();
			if(timeLimit && Date.now() >= timeLimit){
				console.error("Exceeded process time limit on event: "+event._id);
				break;
			}
			date = countInfo.nextDate;
			repeats = this.rruleManager.evaluateRRule(date, datesInEvent[0], event.dtstart, event.rrule, event.exdates, event.tzId, countInfo);
			if(repeats){
				countInfo.used++;
				if(repeats !== -1){
					countInfo.occurrences.push(this.occurrenceStart(date, startClock, event.tzId));
				}
			}
			countInfo.nextDate = this.nextDate(date);
		}

		return this.reconstructOccurrences(event, countInfo.occurrences, range);
	},
	
	reconstructOccurrences: function reconstructOccurrences(event, occurrences, range){
		var occLength = occurrences.length;
		var duration = event.dtend - event.dtstart;
		var inRangeOccurrences = [];
		for(var i = 0; i < occLength; i++){
			var instanceStart = occurrences[i];
			if(instanceStart + duration >= range.start && instanceStart < range.end){
				inRangeOccurrences.push(this.makeOccurrence(event, instanceStart, instanceStart + duration));
			}
		}
		return inRangeOccurrences;
	},
	
	findRepeatsInRangeHelper: function findRepeatsInRangeHelper(event, range, datesInRange, datesInEvent, limit){
		var date;
		var repeatsOnDate;
		var start;
		var end;
		var duration = event.dtend - event.dtstart;
		var rrule = event.rrule;
		var firstDate = datesInEvent[0];
		var startClock = this.timeOfDay(this.wallClockOf(event.dtstart, event.tzId));
		var datesInRangeSize = datesInRange.length;
		var eventOccurrences = [];
		var numFound = 0;

		if (isNaN (limit)) {
			limit = 0;
		}

		//evaluate each date in the range.
		//NOTE: There's no way events could happen 2x in one day here, because we are in the event's timezone.
		for (var i = 0; i < datesInRangeSize; i++){
			var timeLimit = this.getGEIRTimeLimit();
			if(timeLimit && Date.now() >= timeLimit){
				console.error("Exceeded process time limit on event: "+event._id+" at date: "+i + " of "+datesInRangeSize);
				break;
			}
			date = datesInRange[i];

			//Has the event's repeat cycle even started yet?
			if(date < firstDate){
				continue;
			}

			repeatsOnDate = this.rruleManager.evaluateRRule(date, firstDate, event.dtstart, rrule, event.exdates, event.tzId, event.countInfo);
			if (!repeatsOnDate) {
				continue;
			}
			//If repeatsOnDate == -1, that means it repeated on that date, but it was an EXDATE.
			//webOS CE: limit is how many occurrences the caller wants, and this isn't one. COUNT repeats
			//don't come through here, so nothing needs an exception counted.
			if(repeatsOnDate === -1){
				continue;
			}

			start = this.occurrenceStart(date, startClock, event.tzId);
			end = start + duration;

			//Did the event's repeat cycle already end?
			if(rrule.until && this.untilPassed(rrule.until, date, start)){
				continue;
			}

			//Are the times within the original search range? (not the expanded search range)
			if(!(end >= range.start && start < range.end)){
				continue;
			}

			eventOccurrences.push (this.makeOccurrence(event, start, end));
			numFound++;
			if (numFound === limit) {
				return eventOccurrences;
			}
		}

		return eventOccurrences;
	},
	
	/*
     * getEventRenderTimes: finds the start times within each day of the range for the specified event, and sets
     * event.renderStartTime and event.renderEndTime.
     * @param event: the event to find the start and end times for
     * @param dates: an array of timestamps representing midnight for each day in a range
     * @returns: an array of event objects cloned from the original event, with two added properties on each:
     *    renderStartTime: timestamp representing the start time of the event on in a particular day
     *    renderEndTime: timestamp representing the end time of the event on in a particular day
     *    Together, these two indicate the hours on a particular day during which the event happens.
     */
	getEventRenderTimes: function(eventArray, dates){
		var eventsByDay	= [];

		if (!(eventArray && eventArray.length && dates && dates.length)) {
			return eventsByDay;
		}

		var eventsLength = eventArray.length;
		var datesLength = dates.length;
		var lastDate = new Date(dates[dates.length - 1]).addDays(1).getTime();
		var date = new Date();					// Temp Date instance used for multiple timestamp calculations.
		for (var j = 0; j < eventsLength; j++) {
			var event = eventArray[j];		
			var start = (event.currentLocalStart < dates[0]) ? dates[0] : event.currentLocalStart;
			var end = (event.currentLocalEnd > lastDate) ? lastDate : event.currentLocalEnd;
			var midnights = [start];

			for(var i = 0; i < datesLength; i++){
				if (dates[i] > start && dates[i] < end) {
					midnights.push(dates[i]);
				}
			}		
			midnights.push(end);
			
//			if(this.logging){
//				for (i = 0; i < midnights.length; i++) {
//					//this.evlog(this.logLevels.renderTimes, "getEventRenderTimes: midnights: "+new Date(midnights[i]));	
//				}
//			}		
			
			var days = midnights.length -1;	// Number of days on which this event occurs.
			
			for (i = 0; i < days; i++) {
				var nextOccurrence = ObjectUtils.clone (event);
	
				if(event.allDay){
					// If this is an all-day event, set its render times to 12am to 23:59:59:
					nextOccurrence.renderStartTime	= date.setTime (midnights [i]) && date.clearTime().getTime();
					nextOccurrence.renderEndTime	= date.setTime (nextOccurrence.renderStartTime + 86399000);
				}
				else {
					nextOccurrence.renderStartTime	= midnights [i];
					nextOccurrence.renderEndTime	= midnights [i+1];
				}
			
				//this.evlog(this.logLevels.renderTimes, "getEventRenderTimes: occurrence: "+new Date(nextOccurrence.renderStartTime) +" - "+new Date(nextOccurrence.renderEndTime));	
	
				eventsByDay.push(nextOccurrence);
			}			
		}
					
		return eventsByDay;		
	},
	
    /* 
     * formatResponse: Takes an array of events and a range.
     * Sorts the events into separate arrays for regular events and all day events.
     * Splits these arrays into an array for each date in the date array.
     * @param events		: an array of events. Events are assumed to have renderStartTime and renderEndTime set by this point.
     * @param dates			: an array of dates
     * @param calendarId	: optional string. include only events with this calendarId in the results
     * @param excludeList	: optional object. This object is an associative array of calendarIds. If no calendarId was
     *						  supplied, any events whose calendarId is in this object will be excluded from the results.
     * @returns: an array of day objects:
     *		day =
			{	date		: dateOfDay
			,	events		: eventsInDay[]
			,	allDayEvents: allDayEventsInDay[]
			,	freeTimes	: []
			,	busyTimes	: []
			,	hiddenEvents: []
			,	hiddenAllDay: []
			} 
     */
	formatResponse: function (events, dates, calendarId, excludedCalendars){
		var	allDayEvents	= []
		,	datesLength		= dates.length
		,	day
		,	days			= []
		,	eventsLength	= events.length
		,	hiddenAllDay	= []
		,	hiddenEvents	= []
		,	i
		,	regularEvents	= [];

		// If we don't have any dates do nothing:
		if (!datesLength) {
			return;
		}

		// If the current calendar is an excluded calendar ignore all excluded calendars:
		var useExcluded = excludedCalendars && !(calendarId && excludedCalendars [calendarId]);

		// Split normal and hidden all-day and regular events into separate arrays:
		var event, isHidden;
		for (i = 0; i < eventsLength; i++){
			event = events[i];

			// Filter events by calendar id or excluded calendar:
			isHidden	=  ((calendarId && (calendarId != event.calendarId))
						||  (useExcluded && excludedCalendars [event.calendarId]));

			if (event.allDay) {
				(isHidden ? hiddenAllDay : allDayEvents).push (event);
			} else {
				(isHidden ? hiddenEvents : regularEvents).push (event);
			}
		}

		// If we only have one date, all events are on that day:
		if (datesLength == 1) {
			days.push(
			{	date		: dates[0]
			,	events		: regularEvents
			,	allDayEvents: allDayEvents
			,	freeTimes	: []
			,	busyTimes	: []
			,	hiddenEvents: hiddenEvents
			,	hiddenAllDay: hiddenAllDay
			});
			//this.evlog(this.logLevels.responses, "formatResponse: "+JSON.stringify(days));
			return days;
		}

		// We have no events so fill each day with empty sets:
		if (eventsLength === 0) {
			for (i = 0; i < datesLength; i++) {
				days.push(
				{	date		: dates[i]
				,	events		: []
				,	allDayEvents: []
				,	freeTimes	: []
				,	busyTimes	: []
				,	hiddenEvents: []
				,	hiddenAllDay: []
				});
			}
			//this.evlog(this.logLevels.responses, "formatResponse: "+JSON.stringify(days));
			return days;
		}		

		//Split the events into day arrays
		var allDayEventsByDay	= this.splitByDays (allDayEvents	, dates)
		,	eventsByDay			= this.splitByDays (regularEvents	, dates)
		,	hiddenByDay			= this.splitByDays (hiddenEvents	, dates)
		,	hiddenAllDayByDay	= this.splitByDays (hiddenAllDay	, dates);

		for(i = 0; i < datesLength; i++) {
			days.push(
			{	date		: dates[i]
			,	events		: eventsByDay[i]
			,	allDayEvents: allDayEventsByDay[i]
			,	freeTimes	: []
			,	busyTimes	: []
			,	hiddenEvents: hiddenByDay[i]
			,	hiddenAllDay: hiddenAllDayByDay[i]
			});
		}

		//this.evlog(this.logLevels.responses, "formatResponse: "+JSON.stringify(days));
		return days;
	},
	
	/* 
	 * Splits an array of events into separate arrays of events for each date in an array of dates.  
	 * The split is done based on the event.renderStartTime property.
	 * Each sub-array contains all the events for that date.
	 * @param eventsToSplit: an array of events. Events are assumed to have renderStartTime and renderEndTime set by this point.
	 * @param dates: an array of timestamps representing the date break points to split on
	 * @returns: an array of arrays of events
	 */
	splitByDays: function(eventsToSplit, dates){
		var datesLength = dates.length;
		var eventsToSplitLength = eventsToSplit.length;
		var sliceStartIndex = 0;
		var sliceEndIndex = 0;
		var eventIndex = 0;
		var dateIndex = 1;
		var eventsByDay = [];
		var events;
		
		while(dateIndex < datesLength && eventIndex < eventsToSplitLength){
			var event = eventsToSplit[eventIndex];
			//if(event && event.currentLocalStart >= dates[dateIndex]){
			if(event && event.renderStartTime >= dates[dateIndex]){
				if (eventIndex - 1 < 0) {
					events = [];
				}
				else {
					events = eventsToSplit.slice(sliceStartIndex, eventIndex);
				}

				eventsByDay.push(events);
				sliceStartIndex = eventIndex;
				dateIndex++;
			}
			else{
				eventIndex++;
			}
		}

		//We still have events left and we're on the last date
		if(eventIndex <= eventsToSplitLength){
			//get the last events			
			events = eventsToSplit.slice(sliceStartIndex);
			eventsByDay.push(events);
			dateIndex++;
		}
		
		//We ran out of events, and we have dates left to push empty arrays for.
		while (dateIndex <= datesLength) {
			eventsByDay.push([]);
			dateIndex++;
		}
		return eventsByDay;
	},
	
	
	findOffset: function(timestamp, tzId){
		var year = new Date(timestamp).getFullYear();
		var localTzId = this.timezoneManager.getSystemTimezone();
		var timeNoMillis = timestamp / 1000;
		var localOffsetFromUTCInSeconds = this.timezoneManager.getOffset(year, localTzId, timeNoMillis);
		var rangeOffsetFromUTCInSeconds = this.timezoneManager.getOffset(year, tzId, timeNoMillis);	
		var offsetFromLocalInSeconds = rangeOffsetFromUTCInSeconds - localOffsetFromUTCInSeconds;
		var offsetMinutes = offsetFromLocalInSeconds / 60;
		return offsetMinutes;
		
	},
	
	/*
	 * Takes a range and returns an array of timestamps representing midnight for each day contained in the range.
	 * MIDNIGHT IN THE RANGE'S TIMEZONE.
	 *
	 * Where do these dates end up:
	 *  - getEventRenderTimes - this expects midnight, but its supplied range also will always be local time, and so only goes through the first case.
	 *  - evaluateRRule:
	 *    - evaluateExceptions - does not care about midnight time, just wants a date, actually changes the time to be event start time. Currently contains
	 *            some awkward conversions between dates and strings, and dates and timezones to start with.        
	 *    - freqType**** - 
	 *      - used to calculate # of days between for interval
	 *      - uses properties of the date to test the rules (month, day of week, etc.)
	 *      - this must be the right number, type of day, etc, not a timestamp equivalent.
	 *
	 * @param range a date range object
	 * @returns an array of timestamps
	 */
	getDatesInRange: function (range){
		var	dates			= []
		,	startTimestamp	= range.start
		,	endTimestamp	= range.end
		,	localTzId		= this.timezoneManager.getSystemTimezone()
		;

		// webOS CE: read the range off the clock in the range's zone, then hold that reading on the
		// device's clock, where Date can say which calendar days it covers.
		if (range.tzId != localTzId) {
			var	startClock	= new Date (this.wallClockOf (startTimestamp, range.tzId))
			,	endClock	= new Date (this.wallClockOf (endTimestamp, range.tzId))
			;
			startTimestamp = new Date (startClock.getUTCFullYear(), startClock.getUTCMonth(), startClock.getUTCDate()).getTime();
			endTimestamp = new Date (endClock.getUTCFullYear(), endClock.getUTCMonth(), endClock.getUTCDate(), endClock.getUTCHours(), endClock.getUTCMinutes(), endClock.getUTCSeconds()).getTime();
		}

		var midnight = ((new Date (startTimestamp)).set
		({	hour		: 0
		,	minute		: 0
		,	second		: 0
		,	millisecond	: 0
		}));

		var time;
		do
		{	dates.push (time || (time = midnight.getTime()));							// Save current midnight
			midnight.addDays(1);
			time = midnight.getTime();
		}
		while (time < endTimestamp);

		return dates;
	},	
	 
	/*
	 * findBusyBlocksInDays: Takes the results of getEventsInRange, and converts it into a format used to construct a busyDays string.
	 * @param days: an array of days, the results of a call to getEventsInRange
	 * @param calendarId: the calendarId of the displayed calendar.  BusyTimes containing events in this calendar will be marked as such.
	 * @returns: an array of objects, one for each day in the days array, detailing if that day has an event at the beginning, middle, or end,
	 * any all day events, and if any of those events belong to the specified calendar.	 
	 */ 
	findBusyBlocksInDays: function (days, calendarId)
	{	
		// Beginning interval : 12am - 12pm 
		// Middle interval : 12pm - 5pm
		// End interval :  5pm - 12am
		var MORNING_ENDS = 12;
		var MIDDAY_ENDS = 17;	
		var eventDays = [];
		var daysLength = days.length;
		var timeMachine = new Date();
		//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays begin");
		for(var i = 0; i < daysLength; i++){
			
			//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: date: "+new Date(days[i].date));
			var midnight = days[i].date;
			var oneAm = midnight + 3600000;		
			var eventDay = {allDay: false, beg: false, mid: false, end: false, calAllDay: false, calBeg: false, calMid: false, calEnd: false};
						
			var allEvents = days[i].allDayEvents.concat(days[i].hiddenAllDay, days[i].events, days[i].hiddenEvents);
			
			var eventsLength = allEvents.length;
			var maxTrue = 8;
			var numTrue = 0;
			//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: allEventsLength: "+eventsLength);
			for(var j = 0; j < eventsLength; j++){
			
				var event = allEvents[j];
				timeMachine.setTime(event.renderStartTime);
				var eventStart = timeMachine.getHours();
				var eventEndTime = timeMachine.setTime(event.renderEndTime);
				var eventEnd = timeMachine.getHours();
				
				//if eventEnd hour is 0/midnight, it could be the end of the day, or it could be early in the morning.
				if(eventEnd === 0){
					
					eventEnd = 24;
					//if it's early in the morning, then fudge and use 1.
					if(eventEndTime < oneAm){
						//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: adjusting for 1am");
						eventEnd = 1;	
					}
				}			
				if (event.allDay) {
					//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: allday event");
					if (!eventDay.allDay) {
						//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: setting allday true");
						eventDay.allDay = true;
						numTrue++;
						if (calendarId != -1 && (!eventDay.calAllDay) && event.calendarId == calendarId) {
							//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: setting calAllday true");
							eventDay.calAllDay = true;
							numTrue++;
						}
					}
					
				}
				else {
					//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: timed event");
					if ((!eventDay.beg) && (eventEnd > 0 && eventStart < MORNING_ENDS)) {
						//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: morning event");
						eventDay.beg = true;
						numTrue++;						
						if (calendarId != -1 && (!eventDay.calBeg) && event.calendarId == calendarId) {
							//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: calMorning event");
							eventDay.calBeg = true;
							numTrue++;
						}
						
					}
					if ((!eventDay.mid) && (eventEnd > MORNING_ENDS && eventStart < MIDDAY_ENDS)) {
						//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: midday event");
						eventDay.mid = true;
						numTrue++;
						if (calendarId != -1 && (!eventDay.calMid) && event.calendarId == calendarId) {
							//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: calMidday event");
							eventDay.calMid = true;
							numTrue++;
						}
					}
					if ((!eventDay.end) && (eventEnd > MIDDAY_ENDS && eventStart < 24)) {
						//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: end event");
						eventDay.end = true;
						numTrue++;
						if (calendarId != -1 && (!eventDay.calEnd) && event.calendarId == calendarId) {
							//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: calEnd event");
							eventDay.calEnd = true;
							numTrue++;
						}
					}
				}
				//We've set everything possible to true for this day.  Cut out early and skip to the next day.
				if (numTrue === maxTrue) {
					//this.evlog(this.logLevels.getBusyDays, "findBusyBlocksInDays: cutting out early");
					break;
				}
			}
			eventDays.push(eventDay);			
		}
		return eventDays;
	},
	
	/*
	 * busyDaysToString: Takes the results of findBusyBlocksInDays, and converts it into two strings - one for regular events, and one
	 * for all day events.
	 * @param days: an array of eventDay objects, the results of a call to findBusyBlocksInDays
	 * @returns: an object containing two strings	 
	 */ 
	busyDaysToString: function(days)
	{
		var STATE_TO_TOKEN = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-";
		var dayString = "";
		var allDayString = "";
		var daysLength = days.length;
		for (var i = 0; i < daysLength; i++) {
			var state = 0;
			var allDayState = 0;
			var day = days[i];
			// If we have no day, then we set everything to 0
			// Otherwise ...
			if (day !== null) {
				if (day.beg) {
					state |= 1;
				}
				if (day.mid) {
					state |= 2;
				}
				if (day.end) {
					state |= 4;
				}
				if (day.calBeg) {
					state |= 8;
				}
				if (day.calMid) {
					state |= 16;
				}
				if (day.calEnd) {
					state |= 32;
				}
				if(day.allDay){
					allDayState |= 1;
				}
				if(day.calAllDay){
					allDayState |= 2;
				}
			}
			// Translate the 6-bits of state information to one of 64 symbols
			dayString	+= STATE_TO_TOKEN [state];
			allDayString+= STATE_TO_TOKEN [allDayState];
		}
		//this.evlog(this.logLevels.getBusyDays, "busyDaysToString: dayString: "+dayString);
		//this.evlog(this.logLevels.getBusyDays, "busyDaysToString: allDayString: "+allDayString);
		return { regular: dayString, allDay: allDayString };
	}
});



var EventManager = Class.create ({

	initialize: function () {

		this.queryResults				= [];
		this.databaseChangedObservers	= {};
		this.utils						= new EventManagerUtils();
		this.rruleManager				= new RRuleManager();
		this.timezoneManager			= new TimezoneManager();
		this.lastRevsetNumber			= 0;
		this.cancelGetEventsInRange		= _.bind (this.cancelGetEventsInRange, this);
///*DEBUG:*/	this.timing = {};
	},
	
	logLevels:  
	{
		getEvents			: 0x00000001,
		getEventsInRange	: 0x00000010,
		getBusyDays			: 0x00000100,
		findNextOccurrence	: 0x00001000,
		dates				: 0x00010000,
		responses			: 0x00100000,
		timeout				: 0x01000000,
		all					: 0x11111111
	},
		
	evlog: function(level, string){
//		this.logging = true;
//		var filterLevel = this.logLevels.all;
//		if((filterLevel & level) > 0){
//			console.info("========== eventmgr: "+string);	
//		}		
	},

	cleanup: function() {
		//TODO: Maybe unsubscribe from MojoDB change notifications...
	},

	observeDatabaseChanges: function(sceneName, controller) {
		this.databaseChangedObservers[sceneName] = controller;
	},

	stopObservingDatabaseChanges: function(sceneName) {
		this.databaseChangedObservers[sceneName] = undefined;
	},
	
	notifyObservers: function() {
		for (var observer in this.databaseChangedObservers) {
			if(this.databaseChangedObservers.hasOwnProperty(observer) && this.databaseChangedObservers[observer]){
				this.databaseChangedObservers[observer].databaseChanged();	
			}
			
		} 
	},
		
	getEvents: function () {
		/*
		 * getEvents: 
		 *
		 * There are two operations here: a watch and a query.
		 * The watch looks for all changes later than the last eventDisplayRevset.
		 * The query is actually a batch of three queries:
		 *   - Query for all events
		 *   - Query for the last event added/updated
		 *   - Query for the last event deleted
		 *    
		 * The first query is the event result set.
		 * The last two queries are used to determine the lastRevsetNumber.
		 * As of 10/15/2010, there is no way to query in mojoDB for all events added/updated/deleted and use an orderBy clause.    
		  *
		 * For result sets larger than the DB limit, the DB response will
		 * contain a "next" field (i.e. {next:"<some db id>"}) that will
		 * be used in subsequent queries to build the full result set.
		 */

		var	handleEvents
		,	watchEvents
		,	handleWatch
		,	queryEvents
		,	thi$	= this;

		var query = {	"from"		: "com.palm.calendarevent:1"
					,	"orderBy"	: "eventDisplayRevset"
					};
					
		var queryOp =	{	"method": "find"
						,	"params": 
							{	"query": query	}
						};		
					
		var revsetOp1 = {	"method": "find"
						,	"params":
							{	"query":
								{	"from"		: "com.palm.calendarevent:1"
								,	"orderBy"	: "eventDisplayRevset"
								,	"desc"		: true
								,	"limit"		: 1
								}
							}
						};
								
		var revsetOp2 = {	"method": "find"
						,	"params":
							{	"query": 
								{	"from"		: "com.palm.calendarevent:1"
								,	"where"		: [{"prop": "_del", "op": "=", "val": true}]
								,	"orderBy"	: "eventDisplayRevset"
								,	"desc"		: true
								,	"limit"		: 1
								}
							}
						};
													
		var operations = {	"operations" : [revsetOp1, revsetOp2, queryOp]	};
							
		watchEvents = function watchEvents() {
			// Keep reference to DB request to prevent aggressive Garbage Collection:
			if(thi$.watchRequest){
				PalmCall.cancel(thi$.watchRequest);	
			}		
			
			delete thi$.watchRequest;
			
			var	watchQuery =	{	"subscribe": true
								,	"query":
									{	"from"		: "com.palm.calendarevent:1"
									,	"where"		: [{"prop": "eventDisplayRevset", "op": ">", "val": thi$.lastRevsetNumber}]
									,	"incDel"	: true
									}
								};
							
			thi$.watchRequest = DB.execute ("watch", watchQuery);
			thi$.watchRequest.then(handleWatch);
		};

		handleWatch = function handleWatch (future) {
			var response = future.result;

			//the watch was successfully set up
			if(response && response.returnValue === true && !response.fired && !response.results){
				future.then(handleWatch);
			}
			
			//the watch fired
	        if(response && response.fired){
				queryEvents();		// If the DB events watch fires, re-query and setup another watch.
				return true;
			}
		};

		queryEvents = function queryEvents() {
			// Keep reference to DB request to prevent aggressive Garbage Collection:
			delete thi$.dbRequest;
			thi$.dbRequest = DB.execute ("batch", operations);
			thi$.dbRequest.then(handleEvents);
		};

		
		function getRevsetNumber(response) {
			var revsetNumber = 0;
			if(response){
				var result = response.results;
				if(result && result.length){
					revsetNumber = result[0].eventDisplayRevset;
				}
			}
			return revsetNumber;
		}

		handleEvents = function handleEvents (future) {
			var result = future.result;			
			var responses = result && result.responses;
			
			if(!responses){
				console.error("Event Manager: batch query failed");
				return false;
			}
			
			var revsetResponse1 = responses[0]
			,	revsetResponse2 = responses[1]
			,	queryResponse   = responses[2]
			;

			thi$.queryResults	= query.page										// If processing a page of results
								? thi$.queryResults.concat (queryResponse.results)	// add the page of results to the total results
								: queryResponse.results;							// otherwise set total resuls to this result set.

			if (queryResponse.next) {											// Result set is larger than DB's max (i.e. 500)
				query.page = queryResponse.next;								// so identify next page of results,
	            queryEvents();													// retrieve them
				return true;													// then set this DB.find future's result so it completes.
			}

			delete query.page;													// Last or only page of results so clear query's page.	

			var revsetNum1 = getRevsetNumber(revsetResponse1) || 0;
			var revsetNum2 = getRevsetNumber(revsetResponse2) || 0;
			
			thi$.lastRevsetNumber = Math.max(revsetNum1, revsetNum2);
												
			thi$.utils.loadTimezones (thi$.queryResults);						// Cache any new timezone rules.
			thi$.notifyObservers();												// Notify listeners of event changes.
			watchEvents();														// Continue observing DB changes.
			return true;
		};

		queryEvents();
	},

	cancelGetEventsInRange: function cancelGetEventsInRange (stopTimestamp) {
		if (isNaN (stopTimestamp)) {
			stopTimestamp = parseInt (stopTimestamp, 10);
			if (isNaN (stopTimestamp)) {
				stopTimestamp = Date.now();
			}
		}
		var utils = this.utils;
		if (stopTimestamp < utils.getGEIRTimeLimit())  {
			utils.setGEIRTimeLimit (stopTimestamp);
		}
	},

	/*
     * getEventsInRange: finds all occurrences of events in the query results that occur within the specified range,
     * sorted by start date, and broken down by day.
     * @param range: a date range object (start, end, tzid, calendarId, excludeList)
     *		- start:	the start of the range - timestamp
     *		- end:		the end of the range - timestamp
     *		- tzId:		timezone
     *		- calendarId: optional string. include only events with this calendarId in the results
     *		- excludeList: optional object. This object is an associative array of calendarIds. If no calendarId was
     *					supplied, any events whose calendarId is in this object will be excluded from the results.
     * @aparm callback: function to call when results are ready
     * @param eventSet: optional set of events.  If not supplied, it will use this.queryResults.  This parameter is 
     *             here to enable unit tests, and assumes that the events have dtstart and dtend set, as if they came from a database query.
	 * @param limit: optional. number of results to limit the response to.
     * The response generated contains an array of day objects with the following properties:
     *    date: timestamp
     *    events: array of event objects.  Events will have current TZ/local start/end, renderStartTime, and renderEndTime set by the end of this function. 
     *    allDayEvents: array of event objects
     *    freeTimes: array of ??
     *    busyTimes: array of ??
     */
	getEventsInRange: function (range, callback, eventSet, limit) {
		if (!eventSet) {
			eventSet = this.queryResults;
		}

		var	event
		,	events
		,	eventSetSize= eventSet.length
		,	i
		,	chunkInterval
		,	occurrences	= []
		,	thi$ = this
		;
				
		var timeoutLength = 7000;
				
		//We copy the range and use it instead because a) it's not nice to alter parameters that don't belong to you and 
		//b)findRepeatsInRange will append datesInRange to it, which we can reuse if needed, and any external callers who 
		//might be using using and changing range values within a loop won't be affected.
		var tempRange = Foundations.ObjectUtils.clone(range);
		
		var future		= new Future (null);		
		future.tzIds	= this.utils.getUniqueTzIdsInEventSet	(eventSet);
		future.years	= this.utils.getYearsInRange			(tempRange).concat (this.utils.getStartYears (eventSet));

		//load the timezone data needed to process this event set
		future.then	(this.timezoneManager, this.timezoneManager.setup);			
		future.then	(this.timezoneManager, this.timezoneManager.getTimezones);

		future.then	(this, function (future) {
			var result = future.result;
			
			//find which events in the set occur within the range.  
			//this.evlog(this.logLevels.getEventsInRange, "getEventsInRange: Range start: "+new Date(tempRange.start)+" - "+new Date(tempRange.end));

			i = 0;
			var chunkLimit = 50;
			
			//We process in chunks and yield periodically to avoid Webkit's JS timeout.
			function findOccurrences(){
				
				//this.evlog(this.logLevels.timeout, "GEIR: findOccurrences: Timeout at "+this.utils.getGEIRTimeLimit());
				
				var okEvent;
				//i is the index in the full event set. j is the counter for the chunk limit
				for (var j = 0; i < eventSetSize && j < chunkLimit; i++, j++) {
					var timeLimit = this.utils.getGEIRTimeLimit();
					if(timeLimit && Date.now() >= timeLimit){
						//this.evlog(this.logLevels.timeout, "GEIR: Exceeded time limit at event: "+i + " of "+eventSetSize+" / "+eventSet[i]._id);
						break;
					}
					
					//this.evlog(this.logLevels.getEventsInRange, "************** Next event ************************");
					event = eventSet[i];
					okEvent = ("dtstart" in event) && ("dtend" in event) && isFinite(event.dtstart) && isFinite(event.dtend);
					if(!okEvent){
						console.error("===== Skipping malformed calendar event: "+event._id); 
						continue; 
					}
					
					if (!event.rrule) {
						if (this.utils.occursInRange(event, tempRange)) {
							occurrences.push(event);
						}
					}
					else {
						if(event.rrule.count){
							events = this.utils.findRepeatsInRangeCountVersion(event, tempRange);
						}
						else{
							//Repeating events may occur multiple times in the range
							events = this.utils.findRepeatsInRange(event, tempRange, limit);
						}
						
						if (events.length > 0) {
							//this.evlog(this.logLevels.getEventsInRange, "getEventsInRange: Repeating event ["+i+"] occurs "+events.length+" times in range");
							occurrences = occurrences.concat(events);
						}
					}
				}
				
				//If we haven't processed all the events in the event set, return, and this function will get run again.
				if (i < eventSetSize){
					//this.evlog(this.logLevels.timeout, "GEIR: Yielding");					
					return;
				} 
		
				//We've processed all events in the event set.  Now start work to format the response.
				  
				//Have we already calculated the datesInRange for this range/tzId?
				//this.evlog(this.logLevels.getEventsInRange, "===== Done finding occurrences.  Looking for render times =====");
				var dates;
				if(tempRange.datesInRange && tempRange.datesInRange[tempRange.tzId]){
					//this.evlog(this.logLevels.getEventsInRange, "getEventsInRange: reusing existing datesInRange");
					dates = tempRange.datesInRange[tempRange.tzId];
//					if(this.logging){
//						for(var x = 0; x < dates.length; x++){
//							//this.evlog(this.logLevels.dates, "dates: "+new Date(dates[x]));
//						}	
//					}				
				}			
				else{
					dates = this.utils.getDatesInRange(tempRange);
				}
							
				var	eventsWithRenderTimes	= []
				,	occurrencesLength		= occurrences.length
				;
	
				// Get the render times for each occurrence:			
				eventsWithRenderTimes = this.utils.getEventRenderTimes (occurrences, dates);
				
				// Sort by renderStartTime:
				if (eventsWithRenderTimes.length > 0) {
					eventsWithRenderTimes.sort (this.utils.sortByStartTime);
				}
	
				// Split into days arrays:
				var response = { days: this.utils.formatResponse (eventsWithRenderTimes, dates, tempRange.calendarId, tempRange.excludeList) };
				//this.evlog(this.logLevels.responses, "response: "+JSON.stringify(response));
	
				//clean up the setInterval and send the response
				clearInterval (chunkInterval);
				setTimeout (function(){
					thi$.utils.setGEIRTimeLimit(undefined);
					callback (response); 
				}, 15.625);
				future.result = response;
			}//end findOccurrences
			
			//Because large event sets could take a long time, we have to process in chunks and yield periodically to avoid Webkit's JS timeout.
			
			function processEventChunk(){
				thi$.utils.setGEIRTimeLimit(Date.now() + timeoutLength);								
				findOccurrences.apply(thi$); 
			}
			chunkInterval = setInterval (processEventChunk, 31.625);
		});
	},
	
	/*
	 * findNumOccurrencesInRange: finds the number of occurrences of an event within the specified range.
	 * @param event: the event to find the recurrences of
	 * @param range: the range in which to find the recurrences. Range is assumed to be in the device's local time
	 * @param countLimit: stop counting and return if the number of occurrences exceeds this number.  To count all occurrences, pass null.
	 * @returns: the number of occurrences in the range 
	 */
	findNumOccurrencesInRange: function(event, range, countLimit){
		var occurrences;
		if(event.rrule.count){
			occurrences = this.utils.findRepeatsInRangeCountVersion(event, range);
		}
		else{
			occurrences = this.utils.findRepeatsInRange(event, range, countLimit);
		}
		return occurrences.length;
	},
	
	/*
	 * getBusyDays: Finds the busy times within a range.  This is for use with month view.
	 * Busy times are indicators that an event is occurring in the morning/midday/evening block of the day.
	 * Morning = 12am - 12pm
	 * Midday = 12pm - 5pm
	 * Evening = 5pm - 12am
	 * @param range: the range in which to find the busy times. Range is assumed to be in the device's local time
	 * @param calendarId: the calendarId of the displayed calendar.  BusyTimes containing events in this calendar will be marked as such.
	 * @param eventSet: optional set of events.  If not supplied, it will use this.queryResults.  This parameter is 
     *             here to enable unit tests, and assumes that the events have dtstart, dtend, and calendarId set, as if they came from a database query.
	 * @returns: a response object with the following properties:
	 * "date": start of the range 
	 *	"days": a string. Each character in the string represents a day in the range. The character indicates which blocks in the day are busy, and which blocks have
	 *				events that belong to the calendarId specified.  See monthview for more information about the bitflag-ascii encoding going on here.
	 *	"allDay": a string. Each character in the string represents a day in the range. The character indicates if the day has an all day event, and if the
	 *				allday events belong to the calendarId specified.  See monthview for more information about the bitflag-ascii encoding going on here.
	 */	
	
	getBusyDays: function(range, callback, eventSet){
		//this.evlog(this.logLevels.getBusyDays, "getBusyDays begin");
		if (!eventSet) {
			//this.evlog(this.logLevels.getBusyDays, "getBusyDays using queryResults");
			eventSet = this.queryResults;
		}
		
		var busyCallBack = _.bind(this.getBusyDaysCallback, this, callback, range.calendarId);
		this.getEventsInRange(range, busyCallBack, eventSet);
	},

	getBusyDaysCallback: function (callback, calendarId, response) {
		//this.evlog(this.logLevels.getBusyDays, "getBusyDaysCallback begin");
		var	days		= response.days
		,	busyBlocks	= this.utils.findBusyBlocksInDays	(days, calendarId)
		,	busyStrings	= this.utils.busyDaysToString		(busyBlocks);

		var results =  
		{	date	: days[0].date
		,	days	: busyStrings.regular
		,	allDay	: busyStrings.allDay
		};

///*DEBUG:*/	console.log ("\n\n\n\tEventManager:timing: "+JSON.stringify (this.timing)+"\n\n\n");

		callback (results);
	},	

	findNextOccurrenceTimezonePrep: function(eventSet){
		if(!eventSet || eventSet.length === 0){
			return new Foundations.Control.Future({returnValue: true});
		}
		
		//2050 == year in timestamp 2524608000000, which is findNextOccurrence's cut-off point
		var years = [];
		for(var i = new Date().getFullYear(); i < 2051; i++){
			years.push(i);
		}		

		var future = this.timezoneManager.setup();
		future.then(this, function(){
			var result = future.result;
			future.tzIds = this.utils.getUniqueTzIdsInEventSet(eventSet);
			future.years = years.concat(this.utils.getStartYears(eventSet));
			future.result = result;
		});
		future.then	(this.timezoneManager, this.timezoneManager.getTimezones);
		
		return future;
	},
	/*
	 * findNextOccurrence: finds the next occurrence of an event.
	 * @param event: the event to find the recurrences of
	 * @param date: the timestamp representing the date/time to start searching from.
	 * @returns: the timestamp (local time) representing the start of the next occurrence of the event, 
	 * or false if the event has stopped repeating 
	 */
	findNextOccurrence: function(event, date){
		//Pass in the local range and the event
		//Convert the local range to the event tz range
		//Since RRULE evaluation is done by DAY, we may need to break the range into separate dates.
		//For each date in the tz-range, test if the event repeats on that date
		//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: begin, searching from "+new Date(date));	
		if (!event.rrule || !event.rrule.freq) {
			//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: doesn't repeat");
			return false;
		}
		
		var until;
		
		//We are hard-coding an until date very far in the future so that there's no way this can become an infinite loop if
		//we get some kind of malformed, never possible to repeat RRULE.
		if(event.rrule.until !== null && event.rrule.until !== undefined){
			until = event.rrule.until;
		} 
		else {
			until = 2524608000000; //Fri 01 Jan 2050 00:00:00 GMT || Thu 31 Dec 2049 16:00:00 PST
		}
				
		//If the event has stopped repeating, we're done.
		if(date > until){
			//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: repeat cycle ended");
			return false;
		}

		//We can use findRepeatsInRange, if we have a range.
		//But if we use too big a range, it might be slow, or a memory hog.
		//So we'll start by assuming we ought to be able to find an occurrence somewhere in the next <unit> of repeat. 
		var jumpDuration = 0;
		var interval = 1;
		if(event.rrule.interval){
			interval = parseInt(event.rrule.interval, 10) || 1;
		}

		switch (event.rrule.freq) {
			case "DAILY":
				jumpDuration =  interval * 86400000; //~ 1 day;
				//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: daily jump duration: "+interval+" days");
				break;
			case "WEEKLY":
				jumpDuration = interval * 604800000; //~ 1 week
				//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: weekly jump duration: "+interval+" weeks");
				break;
			case "MONTHLY":
			case "YEARLY"://I'd rather loop 12 times than do a year-long range
				jumpDuration = interval * 2678400000; //~ 1 month
				//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: monthly jump duration: "+interval+" months");
				break;
			default:
				return false;
		}

		var repeatCycleContinues = true
		,	start = date
		,	end = date
		,	baseOccurrence
		,	nextOccurrence
		,	tzId = this.timezoneManager.getSystemTimezone()
		,	i
		,	nEvents
		,	endDate
		,	timeMachine = new Date()
		;
		//if event & range timezone aren't the same, convert the range to the event's timezone
		var datesInEvent = this.utils.getDatesInRange({start: event.dtstart, end: event.dtend, tzId: event.tzId});
		var datesInEventSize = datesInEvent.length;
		
		while (repeatCycleContinues) {
			//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: LOOP");
			start = end;
			end = end + jumpDuration;
			var range = {start: start, end: end, tzId: tzId};
			//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: calling FIND REPEATS IN RANGE");
			// get the events that are more closer to the date
			var events;
			if(event.rrule.count){
				events = this.utils.findRepeatsInRangeCountVersion(event, range);
				if(event.rrule.count && event.countInfo && event.rrule.count == event.countInfo.length){
					repeatCycleContinues = false;
				}
			}
			else{				
				events = this.utils.findRepeatsInRange(event, range, datesInEventSize);
			}
			nEvents = events && events.length || 0;
			//if there are events that are closer to the date check if there is the occurrence we search for
			for (i=0;i < nEvents;i++) {
				if (events[i].currentLocalStart > date) {
					nextOccurrence = events[i].currentLocalStart;
					break;
				}
			}
			if (nextOccurrence) {
				return nextOccurrence;
			}
			//if the next occurrence is not found then pick the closest event to the date and take it's start 
			//don't go more in the past if an event was already found, but use it as a base to calculate the next date ranges
			if (nEvents > 0 && events[nEvents-1].currentLocalStart <= date) {
				if (!baseOccurrence || baseOccurrence.getTime() < events[nEvents-1].currentLocalStart) {
					timeMachine.setTime(events[nEvents-1].currentLocalStart);
					baseOccurrence = timeMachine;
				}
				end = baseOccurrence.addDays(1).getTime();
			}
			
			if(end > until){
				repeatCycleContinues = false;
			}
		}
		//this.evlog(this.logLevels.findNextOccurrence, "findNextOccurrence: NOT FOUND");
		return false;
	}
});

(function(){
	/** Closure to hold private singular EventManager instance. */

	// Create the singular private EventManager instance:
	var singleton = new EventManager();

	// Override the EventManager constructor to always returns its singular instance:
	EventManager = function EventManager(){
		return singleton;
	};

})();

exports.EventManager = EventManager;

}