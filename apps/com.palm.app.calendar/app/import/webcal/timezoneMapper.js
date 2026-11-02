/* Windows timezones do not follow the IANA convention
   This utility maps a Windows timezone name to an IANA timezone name for compatibility
   Mapping file thanks to: https://github.com/y-hatano-github/Windows-IANA-timezone
*/

var timezoneMapper = {

    mapWindowsToIANA: function(tzWindows) {
        for (var i=0; i<tzMap.length; i++) {
            if (tzMap[i].tz_windows == tzWindows){
                Log.log_icalDebug("** Found timezone name map for Windows ", tzWindows, " as IANA ", tzMap[i].tz_iana);
                return tzMap[i].tz_iana;
            }			
        }
        return null;
    },

    mapIANAToWindows: function(tzIANA) {
        for (var i=0; i<tzMap.length; i++) {
            if (tzMap[i].tz_iana == tzIANA){
                Log.log_icalDebug("** Found timezone name map for IANA ", tzIANA, " as Windows ", tzMap[i].tz_windows);
                return tzMap[i].tz_windows;
            }			
        }
        return null;
    },

    tzMap: function() {
        return tzMap;
    }
};

var tzMap = [
    {
        "tz_windows": "Dateline Standard Time",
        "tz_iana": "Etc/GMT+12"
    },
    {
        "tz_windows": "Dateline Standard Time",
        "tz_iana": "Etc/GMT+12"
    },
    {
        "tz_windows": "UTC-11",
        "tz_iana": "Etc/GMT+11"
    },
    {
        "tz_windows": "UTC-11",
        "tz_iana": "Pacific/Pago_Pago"
    },
    {
        "tz_windows": "UTC-11",
        "tz_iana": "Pacific/Niue"
    },
    {
        "tz_windows": "UTC-11",
        "tz_iana": "Pacific/Midway"
    },
    {
        "tz_windows": "UTC-11",
        "tz_iana": "Etc/GMT+11"
    },
    {
        "tz_windows": "Aleutian Standard Time",
        "tz_iana": "America/Adak"
    },
    {
        "tz_windows": "Aleutian Standard Time",
        "tz_iana": "America/Adak"
    },
    {
        "tz_windows": "Hawaiian Standard Time",
        "tz_iana": "Pacific/Honolulu"
    },
    {
        "tz_windows": "Hawaiian Standard Time",
        "tz_iana": "Pacific/Rarotonga"
    },
    {
        "tz_windows": "Hawaiian Standard Time",
        "tz_iana": "Pacific/Tahiti"
    },
    {
        "tz_windows": "Hawaiian Standard Time",
        "tz_iana": "Pacific/Johnston"
    },
    {
        "tz_windows": "Hawaiian Standard Time",
        "tz_iana": "Pacific/Honolulu"
    },
    {
        "tz_windows": "Hawaiian Standard Time",
        "tz_iana": "Etc/GMT+10"
    },
    {
        "tz_windows": "Marquesas Standard Time",
        "tz_iana": "Pacific/Marquesas"
    },
    {
        "tz_windows": "Marquesas Standard Time",
        "tz_iana": "Pacific/Marquesas"
    },
    {
        "tz_windows": "Alaskan Standard Time",
        "tz_iana": "America/Anchorage"
    },
    {
        "tz_windows": "Alaskan Standard Time",
        "tz_iana": "America/Juneau"
    },
    {
        "tz_windows": "Alaskan Standard Time",
        "tz_iana": "America/Metlakatla"
    },
    {
        "tz_windows": "Alaskan Standard Time",
        "tz_iana": "America/Nome"
    },
    {
        "tz_windows": "Alaskan Standard Time",
        "tz_iana": "America/Sitka"
    },
    {
        "tz_windows": "Alaskan Standard Time",
        "tz_iana": "America/Yakutat"
    },
    {
        "tz_windows": "UTC-09",
        "tz_iana": "Etc/GMT+9"
    },
    {
        "tz_windows": "UTC-09",
        "tz_iana": "Pacific/Gambier"
    },
    {
        "tz_windows": "UTC-09",
        "tz_iana": "Etc/GMT+9"
    },
    {
        "tz_windows": "Pacific Standard Time (Mexico)",
        "tz_iana": "America/Tijuana"
    },
    {
        "tz_windows": "Pacific Standard Time (Mexico)",
        "tz_iana": "America/Tijuana"
    },
    {
        "tz_windows": "Pacific Standard Time (Mexico)",
        "tz_iana": "America/Santa_Isabel"
    },
    {
        "tz_windows": "UTC-08",
        "tz_iana": "Etc/GMT+8"
    },
    {
        "tz_windows": "UTC-08",
        "tz_iana": "Pacific/Pitcairn"
    },
    {
        "tz_windows": "UTC-08",
        "tz_iana": "Etc/GMT+8"
    },
    {
        "tz_windows": "Pacific Standard Time",
        "tz_iana": "America/Los_Angeles"
    },
    {
        "tz_windows": "Pacific Standard Time",
        "tz_iana": "America/Vancouver"
    },
    {
        "tz_windows": "Pacific Standard Time",
        "tz_iana": "America/Los_Angeles"
    },
    {
        "tz_windows": "Pacific Standard Time",
        "tz_iana": "PST8PDT"
    },
    {
        "tz_windows": "US Mountain Standard Time",
        "tz_iana": "America/Phoenix"
    },
    {
        "tz_windows": "US Mountain Standard Time",
        "tz_iana": "America/Creston"
    },
    {
        "tz_windows": "US Mountain Standard Time",
        "tz_iana": "America/Dawson_Creek"
    },
    {
        "tz_windows": "US Mountain Standard Time",
        "tz_iana": "America/Fort_Nelson"
    },
    {
        "tz_windows": "US Mountain Standard Time",
        "tz_iana": "America/Hermosillo"
    },
    {
        "tz_windows": "US Mountain Standard Time",
        "tz_iana": "America/Phoenix"
    },
    {
        "tz_windows": "US Mountain Standard Time",
        "tz_iana": "Etc/GMT+7"
    },
    {
        "tz_windows": "Mountain Standard Time (Mexico)",
        "tz_iana": "America/Chihuahua"
    },
    {
        "tz_windows": "Mountain Standard Time (Mexico)",
        "tz_iana": "America/Chihuahua"
    },
    {
        "tz_windows": "Mountain Standard Time (Mexico)",
        "tz_iana": "America/Mazatlan"
    },
    {
        "tz_windows": "Mountain Standard Time",
        "tz_iana": "America/Denver"
    },
    {
        "tz_windows": "Mountain Standard Time",
        "tz_iana": "America/Edmonton"
    },
    {
        "tz_windows": "Mountain Standard Time",
        "tz_iana": "America/Cambridge_Bay"
    },
    {
        "tz_windows": "Mountain Standard Time",
        "tz_iana": "America/Inuvik"
    },
    {
        "tz_windows": "Mountain Standard Time",
        "tz_iana": "America/Yellowknife"
    },
    {
        "tz_windows": "Mountain Standard Time",
        "tz_iana": "America/Ojinaga"
    },
    {
        "tz_windows": "Mountain Standard Time",
        "tz_iana": "America/Denver"
    },
    {
        "tz_windows": "Mountain Standard Time",
        "tz_iana": "America/Boise"
    },
    {
        "tz_windows": "Mountain Standard Time",
        "tz_iana": "MST7MDT"
    },
    {
        "tz_windows": "Yukon Standard Time",
        "tz_iana": "America/Whitehorse"
    },
    {
        "tz_windows": "Yukon Standard Time",
        "tz_iana": "America/Whitehorse"
    },
    {
        "tz_windows": "Yukon Standard Time",
        "tz_iana": "America/Dawson"
    },
    {
        "tz_windows": "Central America Standard Time",
        "tz_iana": "America/Guatemala"
    },
    {
        "tz_windows": "Central America Standard Time",
        "tz_iana": "America/Belize"
    },
    {
        "tz_windows": "Central America Standard Time",
        "tz_iana": "America/Costa_Rica"
    },
    {
        "tz_windows": "Central America Standard Time",
        "tz_iana": "Pacific/Galapagos"
    },
    {
        "tz_windows": "Central America Standard Time",
        "tz_iana": "America/Guatemala"
    },
    {
        "tz_windows": "Central America Standard Time",
        "tz_iana": "America/Tegucigalpa"
    },
    {
        "tz_windows": "Central America Standard Time",
        "tz_iana": "America/Managua"
    },
    {
        "tz_windows": "Central America Standard Time",
        "tz_iana": "America/El_Salvador"
    },
    {
        "tz_windows": "Central America Standard Time",
        "tz_iana": "Etc/GMT+6"
    },
    {
        "tz_windows": "Central Standard Time",
        "tz_iana": "America/Chicago"
    },
    {
        "tz_windows": "Central Standard Time",
        "tz_iana": "America/Winnipeg"
    },
    {
        "tz_windows": "Central Standard Time",
        "tz_iana": "America/Rainy_River"
    },
    {
        "tz_windows": "Central Standard Time",
        "tz_iana": "America/Rankin_Inlet"
    },
    {
        "tz_windows": "Central Standard Time",
        "tz_iana": "America/Resolute"
    },
    {
        "tz_windows": "Central Standard Time",
        "tz_iana": "America/Matamoros"
    },
    {
        "tz_windows": "Central Standard Time",
        "tz_iana": "America/Chicago"
    },
    {
        "tz_windows": "Central Standard Time",
        "tz_iana": "America/Indiana/Knox"
    },
    {
        "tz_windows": "Central Standard Time",
        "tz_iana": "America/Indiana/Tell_City"
    },
    {
        "tz_windows": "Central Standard Time",
        "tz_iana": "America/Menominee"
    },
    {
        "tz_windows": "Central Standard Time",
        "tz_iana": "America/North_Dakota/Beulah"
    },
    {
        "tz_windows": "Central Standard Time",
        "tz_iana": "America/North_Dakota/Center"
    },
    {
        "tz_windows": "Central Standard Time",
        "tz_iana": "America/North_Dakota/New_Salem"
    },
    {
        "tz_windows": "Central Standard Time",
        "tz_iana": "CST6CDT"
    },
    {
        "tz_windows": "Easter Island Standard Time",
        "tz_iana": "Pacific/Easter"
    },
    {
        "tz_windows": "Easter Island Standard Time",
        "tz_iana": "Pacific/Easter"
    },
    {
        "tz_windows": "Central Standard Time (Mexico)",
        "tz_iana": "America/Mexico_City"
    },
    {
        "tz_windows": "Central Standard Time (Mexico)",
        "tz_iana": "America/Mexico_City"
    },
    {
        "tz_windows": "Central Standard Time (Mexico)",
        "tz_iana": "America/Bahia_Banderas"
    },
    {
        "tz_windows": "Central Standard Time (Mexico)",
        "tz_iana": "America/Merida"
    },
    {
        "tz_windows": "Central Standard Time (Mexico)",
        "tz_iana": "America/Monterrey"
    },
    {
        "tz_windows": "Canada Central Standard Time",
        "tz_iana": "America/Regina"
    },
    {
        "tz_windows": "Canada Central Standard Time",
        "tz_iana": "America/Regina"
    },
    {
        "tz_windows": "Canada Central Standard Time",
        "tz_iana": "America/Swift_Current"
    },
    {
        "tz_windows": "SA Pacific Standard Time",
        "tz_iana": "America/Bogota"
    },
    {
        "tz_windows": "SA Pacific Standard Time",
        "tz_iana": "America/Rio_Branco"
    },
    {
        "tz_windows": "SA Pacific Standard Time",
        "tz_iana": "America/Eirunepe"
    },
    {
        "tz_windows": "SA Pacific Standard Time",
        "tz_iana": "America/Coral_Harbour"
    },
    {
        "tz_windows": "SA Pacific Standard Time",
        "tz_iana": "America/Bogota"
    },
    {
        "tz_windows": "SA Pacific Standard Time",
        "tz_iana": "America/Guayaquil"
    },
    {
        "tz_windows": "SA Pacific Standard Time",
        "tz_iana": "America/Jamaica"
    },
    {
        "tz_windows": "SA Pacific Standard Time",
        "tz_iana": "America/Cayman"
    },
    {
        "tz_windows": "SA Pacific Standard Time",
        "tz_iana": "America/Panama"
    },
    {
        "tz_windows": "SA Pacific Standard Time",
        "tz_iana": "America/Lima"
    },
    {
        "tz_windows": "SA Pacific Standard Time",
        "tz_iana": "Etc/GMT+5"
    },
    {
        "tz_windows": "Eastern Standard Time (Mexico)",
        "tz_iana": "America/Cancun"
    },
    {
        "tz_windows": "Eastern Standard Time (Mexico)",
        "tz_iana": "America/Cancun"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/New_York"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/Nassau"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/Toronto"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/Iqaluit"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/Montreal"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/Nipigon"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/Pangnirtung"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/Thunder_Bay"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/New_York"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/Detroit"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/Indiana/Petersburg"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/Indiana/Vincennes"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/Indiana/Winamac"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/Kentucky/Monticello"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "America/Louisville"
    },
    {
        "tz_windows": "Eastern Standard Time",
        "tz_iana": "EST5EDT"
    },
    {
        "tz_windows": "Haiti Standard Time",
        "tz_iana": "America/Port-au-Prince"
    },
    {
        "tz_windows": "Haiti Standard Time",
        "tz_iana": "America/Port-au-Prince"
    },
    {
        "tz_windows": "Cuba Standard Time",
        "tz_iana": "America/Havana"
    },
    {
        "tz_windows": "Cuba Standard Time",
        "tz_iana": "America/Havana"
    },
    {
        "tz_windows": "US Eastern Standard Time",
        "tz_iana": "America/Indianapolis"
    },
    {
        "tz_windows": "US Eastern Standard Time",
        "tz_iana": "America/Indianapolis"
    },
    {
        "tz_windows": "US Eastern Standard Time",
        "tz_iana": "America/Indiana/Marengo"
    },
    {
        "tz_windows": "US Eastern Standard Time",
        "tz_iana": "America/Indiana/Vevay"
    },
    {
        "tz_windows": "Turks And Caicos Standard Time",
        "tz_iana": "America/Grand_Turk"
    },
    {
        "tz_windows": "Turks And Caicos Standard Time",
        "tz_iana": "America/Grand_Turk"
    },
    {
        "tz_windows": "Paraguay Standard Time",
        "tz_iana": "America/Asuncion"
    },
    {
        "tz_windows": "Paraguay Standard Time",
        "tz_iana": "America/Asuncion"
    },
    {
        "tz_windows": "Atlantic Standard Time",
        "tz_iana": "America/Halifax"
    },
    {
        "tz_windows": "Atlantic Standard Time",
        "tz_iana": "Atlantic/Bermuda"
    },
    {
        "tz_windows": "Atlantic Standard Time",
        "tz_iana": "America/Halifax"
    },
    {
        "tz_windows": "Atlantic Standard Time",
        "tz_iana": "America/Glace_Bay"
    },
    {
        "tz_windows": "Atlantic Standard Time",
        "tz_iana": "America/Goose_Bay"
    },
    {
        "tz_windows": "Atlantic Standard Time",
        "tz_iana": "America/Moncton"
    },
    {
        "tz_windows": "Atlantic Standard Time",
        "tz_iana": "America/Thule"
    },
    {
        "tz_windows": "Venezuela Standard Time",
        "tz_iana": "America/Caracas"
    },
    {
        "tz_windows": "Venezuela Standard Time",
        "tz_iana": "America/Caracas"
    },
    {
        "tz_windows": "Central Brazilian Standard Time",
        "tz_iana": "America/Cuiaba"
    },
    {
        "tz_windows": "Central Brazilian Standard Time",
        "tz_iana": "America/Cuiaba"
    },
    {
        "tz_windows": "Central Brazilian Standard Time",
        "tz_iana": "America/Campo_Grande"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/La_Paz"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Antigua"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Anguilla"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Aruba"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Barbados"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/St_Barthelemy"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/La_Paz"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Kralendijk"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Manaus"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Boa_Vista"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Porto_Velho"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Blanc-Sablon"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Curacao"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Dominica"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Santo_Domingo"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Grenada"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Guadeloupe"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Guyana"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/St_Kitts"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/St_Lucia"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Marigot"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Martinique"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Montserrat"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Puerto_Rico"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Lower_Princes"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Port_of_Spain"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/St_Vincent"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/Tortola"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "America/St_Thomas"
    },
    {
        "tz_windows": "SA Western Standard Time",
        "tz_iana": "Etc/GMT+4"
    },
    {
        "tz_windows": "Pacific SA Standard Time",
        "tz_iana": "America/Santiago"
    },
    {
        "tz_windows": "Pacific SA Standard Time",
        "tz_iana": "America/Santiago"
    },
    {
        "tz_windows": "Newfoundland Standard Time",
        "tz_iana": "America/St_Johns"
    },
    {
        "tz_windows": "Newfoundland Standard Time",
        "tz_iana": "America/St_Johns"
    },
    {
        "tz_windows": "Tocantins Standard Time",
        "tz_iana": "America/Araguaina"
    },
    {
        "tz_windows": "Tocantins Standard Time",
        "tz_iana": "America/Araguaina"
    },
    {
        "tz_windows": "E. South America Standard Time",
        "tz_iana": "America/Sao_Paulo"
    },
    {
        "tz_windows": "E. South America Standard Time",
        "tz_iana": "America/Sao_Paulo"
    },
    {
        "tz_windows": "SA Eastern Standard Time",
        "tz_iana": "America/Cayenne"
    },
    {
        "tz_windows": "SA Eastern Standard Time",
        "tz_iana": "Antarctica/Rothera"
    },
    {
        "tz_windows": "SA Eastern Standard Time",
        "tz_iana": "Antarctica/Palmer"
    },
    {
        "tz_windows": "SA Eastern Standard Time",
        "tz_iana": "America/Fortaleza"
    },
    {
        "tz_windows": "SA Eastern Standard Time",
        "tz_iana": "America/Belem"
    },
    {
        "tz_windows": "SA Eastern Standard Time",
        "tz_iana": "America/Maceio"
    },
    {
        "tz_windows": "SA Eastern Standard Time",
        "tz_iana": "America/Santarem"
    },
    {
        "tz_windows": "SA Eastern Standard Time",
        "tz_iana": "America/Recife"
    },
    {
        "tz_windows": "SA Eastern Standard Time",
        "tz_iana": "Atlantic/Stanley"
    },
    {
        "tz_windows": "SA Eastern Standard Time",
        "tz_iana": "America/Cayenne"
    },
    {
        "tz_windows": "SA Eastern Standard Time",
        "tz_iana": "America/Paramaribo"
    },
    {
        "tz_windows": "SA Eastern Standard Time",
        "tz_iana": "Etc/GMT+3"
    },
    {
        "tz_windows": "Argentina Standard Time",
        "tz_iana": "America/Buenos_Aires"
    },
    {
        "tz_windows": "Argentina Standard Time",
        "tz_iana": "America/Buenos_Aires"
    },
    {
        "tz_windows": "Argentina Standard Time",
        "tz_iana": "America/Argentina/La_Rioja"
    },
    {
        "tz_windows": "Argentina Standard Time",
        "tz_iana": "America/Argentina/Rio_Gallegos"
    },
    {
        "tz_windows": "Argentina Standard Time",
        "tz_iana": "America/Argentina/Salta"
    },
    {
        "tz_windows": "Argentina Standard Time",
        "tz_iana": "America/Argentina/San_Juan"
    },
    {
        "tz_windows": "Argentina Standard Time",
        "tz_iana": "America/Argentina/San_Luis"
    },
    {
        "tz_windows": "Argentina Standard Time",
        "tz_iana": "America/Argentina/Tucuman"
    },
    {
        "tz_windows": "Argentina Standard Time",
        "tz_iana": "America/Argentina/Ushuaia"
    },
    {
        "tz_windows": "Argentina Standard Time",
        "tz_iana": "America/Catamarca"
    },
    {
        "tz_windows": "Argentina Standard Time",
        "tz_iana": "America/Cordoba"
    },
    {
        "tz_windows": "Argentina Standard Time",
        "tz_iana": "America/Jujuy"
    },
    {
        "tz_windows": "Argentina Standard Time",
        "tz_iana": "America/Mendoza"
    },
    {
        "tz_windows": "Greenland Standard Time",
        "tz_iana": "America/Godthab"
    },
    {
        "tz_windows": "Greenland Standard Time",
        "tz_iana": "America/Godthab"
    },
    {
        "tz_windows": "Montevideo Standard Time",
        "tz_iana": "America/Montevideo"
    },
    {
        "tz_windows": "Montevideo Standard Time",
        "tz_iana": "America/Montevideo"
    },
    {
        "tz_windows": "Magallanes Standard Time",
        "tz_iana": "America/Punta_Arenas"
    },
    {
        "tz_windows": "Magallanes Standard Time",
        "tz_iana": "America/Punta_Arenas"
    },
    {
        "tz_windows": "Saint Pierre Standard Time",
        "tz_iana": "America/Miquelon"
    },
    {
        "tz_windows": "Saint Pierre Standard Time",
        "tz_iana": "America/Miquelon"
    },
    {
        "tz_windows": "Bahia Standard Time",
        "tz_iana": "America/Bahia"
    },
    {
        "tz_windows": "Bahia Standard Time",
        "tz_iana": "America/Bahia"
    },
    {
        "tz_windows": "UTC-02",
        "tz_iana": "Etc/GMT+2"
    },
    {
        "tz_windows": "UTC-02",
        "tz_iana": "America/Noronha"
    },
    {
        "tz_windows": "UTC-02",
        "tz_iana": "Atlantic/South_Georgia"
    },
    {
        "tz_windows": "UTC-02",
        "tz_iana": "Etc/GMT+2"
    },
    {
        "tz_windows": "Azores Standard Time",
        "tz_iana": "Atlantic/Azores"
    },
    {
        "tz_windows": "Azores Standard Time",
        "tz_iana": "America/Scoresbysund"
    },
    {
        "tz_windows": "Azores Standard Time",
        "tz_iana": "Atlantic/Azores"
    },
    {
        "tz_windows": "Cape Verde Standard Time",
        "tz_iana": "Atlantic/Cape_Verde"
    },
    {
        "tz_windows": "Cape Verde Standard Time",
        "tz_iana": "Atlantic/Cape_Verde"
    },
    {
        "tz_windows": "Cape Verde Standard Time",
        "tz_iana": "Etc/GMT+1"
    },
    {
        "tz_windows": "UTC",
        "tz_iana": "Etc/UTC"
    },
    {
        "tz_windows": "UTC",
        "tz_iana": "Etc/UTC"
    },
    {
        "tz_windows": "UTC",
        "tz_iana": "Etc/GMT"
    },
    {
        "tz_windows": "GMT Standard Time",
        "tz_iana": "Europe/London"
    },
    {
        "tz_windows": "GMT Standard Time",
        "tz_iana": "Atlantic/Canary"
    },
    {
        "tz_windows": "GMT Standard Time",
        "tz_iana": "Atlantic/Faeroe"
    },
    {
        "tz_windows": "GMT Standard Time",
        "tz_iana": "Europe/London"
    },
    {
        "tz_windows": "GMT Standard Time",
        "tz_iana": "Europe/Guernsey"
    },
    {
        "tz_windows": "GMT Standard Time",
        "tz_iana": "Europe/Dublin"
    },
    {
        "tz_windows": "GMT Standard Time",
        "tz_iana": "Europe/Isle_of_Man"
    },
    {
        "tz_windows": "GMT Standard Time",
        "tz_iana": "Europe/Jersey"
    },
    {
        "tz_windows": "GMT Standard Time",
        "tz_iana": "Europe/Lisbon"
    },
    {
        "tz_windows": "GMT Standard Time",
        "tz_iana": "Atlantic/Madeira"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Atlantic/Reykjavik"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Africa/Ouagadougou"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Africa/Abidjan"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Africa/Accra"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "America/Danmarkshavn"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Africa/Banjul"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Africa/Conakry"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Africa/Bissau"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Atlantic/Reykjavik"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Africa/Monrovia"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Africa/Bamako"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Africa/Nouakchott"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Atlantic/St_Helena"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Africa/Freetown"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Africa/Dakar"
    },
    {
        "tz_windows": "Greenwich Standard Time",
        "tz_iana": "Africa/Lome"
    },
    {
        "tz_windows": "Sao Tome Standard Time",
        "tz_iana": "Africa/Sao_Tome"
    },
    {
        "tz_windows": "Sao Tome Standard Time",
        "tz_iana": "Africa/Sao_Tome"
    },
    {
        "tz_windows": "Morocco Standard Time",
        "tz_iana": "Africa/Casablanca"
    },
    {
        "tz_windows": "Morocco Standard Time",
        "tz_iana": "Africa/El_Aaiun"
    },
    {
        "tz_windows": "Morocco Standard Time",
        "tz_iana": "Africa/Casablanca"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Berlin"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Andorra"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Vienna"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Zurich"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Berlin"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Busingen"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Gibraltar"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Rome"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Vaduz"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Luxembourg"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Monaco"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Malta"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Amsterdam"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Oslo"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Stockholm"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Arctic/Longyearbyen"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/San_Marino"
    },
    {
        "tz_windows": "W. Europe Standard Time",
        "tz_iana": "Europe/Vatican"
    },
    {
        "tz_windows": "Central Europe Standard Time",
        "tz_iana": "Europe/Budapest"
    },
    {
        "tz_windows": "Central Europe Standard Time",
        "tz_iana": "Europe/Tirane"
    },
    {
        "tz_windows": "Central Europe Standard Time",
        "tz_iana": "Europe/Prague"
    },
    {
        "tz_windows": "Central Europe Standard Time",
        "tz_iana": "Europe/Budapest"
    },
    {
        "tz_windows": "Central Europe Standard Time",
        "tz_iana": "Europe/Podgorica"
    },
    {
        "tz_windows": "Central Europe Standard Time",
        "tz_iana": "Europe/Belgrade"
    },
    {
        "tz_windows": "Central Europe Standard Time",
        "tz_iana": "Europe/Ljubljana"
    },
    {
        "tz_windows": "Central Europe Standard Time",
        "tz_iana": "Europe/Bratislava"
    },
    {
        "tz_windows": "Romance Standard Time",
        "tz_iana": "Europe/Paris"
    },
    {
        "tz_windows": "Romance Standard Time",
        "tz_iana": "Europe/Brussels"
    },
    {
        "tz_windows": "Romance Standard Time",
        "tz_iana": "Europe/Copenhagen"
    },
    {
        "tz_windows": "Romance Standard Time",
        "tz_iana": "Africa/Ceuta"
    },
    {
        "tz_windows": "Romance Standard Time",
        "tz_iana": "Africa/Ceuta"
    },
    {
        "tz_windows": "Romance Standard Time",
        "tz_iana": "Europe/Paris"
    },
    {
        "tz_windows": "Central European Standard Time",
        "tz_iana": "Europe/Warsaw"
    },
    {
        "tz_windows": "Central European Standard Time",
        "tz_iana": "Europe/Sarajevo"
    },
    {
        "tz_windows": "Central European Standard Time",
        "tz_iana": "Europe/Zagreb"
    },
    {
        "tz_windows": "Central European Standard Time",
        "tz_iana": "Europe/Skopje"
    },
    {
        "tz_windows": "Central European Standard Time",
        "tz_iana": "Europe/Warsaw"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Africa/Lagos"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Africa/Luanda"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Africa/Porto-Novo"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Africa/Kinshasa"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Africa/Bangui"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Africa/Brazzaville"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Africa/Douala"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Africa/Algiers"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Africa/Libreville"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Africa/Malabo"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Africa/Niamey"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Africa/Lagos"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Africa/Ndjamena"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Africa/Tunis"
    },
    {
        "tz_windows": "W. Central Africa Standard Time",
        "tz_iana": "Etc/GMT-1"
    },
    {
        "tz_windows": "Jordan Standard Time",
        "tz_iana": "Asia/Amman"
    },
    {
        "tz_windows": "Jordan Standard Time",
        "tz_iana": "Asia/Amman"
    },
    {
        "tz_windows": "GTB Standard Time",
        "tz_iana": "Europe/Bucharest"
    },
    {
        "tz_windows": "GTB Standard Time",
        "tz_iana": "Asia/Nicosia"
    },
    {
        "tz_windows": "GTB Standard Time",
        "tz_iana": "Asia/Famagusta"
    },
    {
        "tz_windows": "GTB Standard Time",
        "tz_iana": "Europe/Athens"
    },
    {
        "tz_windows": "GTB Standard Time",
        "tz_iana": "Europe/Bucharest"
    },
    {
        "tz_iana": "Asia/Beirut"
    },
    {
        "tz_iana": "Asia/Beirut"
    },
    {
        "tz_windows": "Egypt Standard Time",
        "tz_iana": "Africa/Cairo"
    },
    {
        "tz_windows": "Egypt Standard Time",
        "tz_iana": "Africa/Cairo"
    },
    {
        "tz_windows": "E. Europe Standard Time",
        "tz_iana": "Europe/Chisinau"
    },
    {
        "tz_windows": "E. Europe Standard Time",
        "tz_iana": "Europe/Chisinau"
    },
    {
        "tz_windows": "Syria Standard Time",
        "tz_iana": "Asia/Damascus"
    },
    {
        "tz_windows": "Syria Standard Time",
        "tz_iana": "Asia/Damascus"
    },
    {
        "tz_windows": "West Bank Standard Time",
        "tz_iana": "Asia/Hebron"
    },
    {
        "tz_windows": "West Bank Standard Time",
        "tz_iana": "Asia/Hebron"
    },
    {
        "tz_windows": "West Bank Standard Time",
        "tz_iana": "Asia/Gaza"
    },
    {
        "tz_windows": "South Africa Standard Time",
        "tz_iana": "Africa/Johannesburg"
    },
    {
        "tz_windows": "South Africa Standard Time",
        "tz_iana": "Africa/Bujumbura"
    },
    {
        "tz_windows": "South Africa Standard Time",
        "tz_iana": "Africa/Gaborone"
    },
    {
        "tz_windows": "South Africa Standard Time",
        "tz_iana": "Africa/Lubumbashi"
    },
    {
        "tz_windows": "South Africa Standard Time",
        "tz_iana": "Africa/Maseru"
    },
    {
        "tz_windows": "South Africa Standard Time",
        "tz_iana": "Africa/Blantyre"
    },
    {
        "tz_windows": "South Africa Standard Time",
        "tz_iana": "Africa/Maputo"
    },
    {
        "tz_windows": "South Africa Standard Time",
        "tz_iana": "Africa/Kigali"
    },
    {
        "tz_windows": "South Africa Standard Time",
        "tz_iana": "Africa/Mbabane"
    },
    {
        "tz_windows": "South Africa Standard Time",
        "tz_iana": "Africa/Johannesburg"
    },
    {
        "tz_windows": "South Africa Standard Time",
        "tz_iana": "Africa/Lusaka"
    },
    {
        "tz_windows": "South Africa Standard Time",
        "tz_iana": "Africa/Harare"
    },
    {
        "tz_windows": "South Africa Standard Time",
        "tz_iana": "Etc/GMT-2"
    },
    {
        "tz_windows": "FLE Standard Time",
        "tz_iana": "Europe/Kiev"
    },
    {
        "tz_windows": "FLE Standard Time",
        "tz_iana": "Europe/Mariehamn"
    },
    {
        "tz_windows": "FLE Standard Time",
        "tz_iana": "Europe/Sofia"
    },
    {
        "tz_windows": "FLE Standard Time",
        "tz_iana": "Europe/Tallinn"
    },
    {
        "tz_windows": "FLE Standard Time",
        "tz_iana": "Europe/Helsinki"
    },
    {
        "tz_windows": "FLE Standard Time",
        "tz_iana": "Europe/Vilnius"
    },
    {
        "tz_windows": "FLE Standard Time",
        "tz_iana": "Europe/Riga"
    },
    {
        "tz_windows": "FLE Standard Time",
        "tz_iana": "Europe/Kiev"
    },
    {
        "tz_windows": "FLE Standard Time",
        "tz_iana": "Europe/Uzhgorod"
    },
    {
        "tz_windows": "FLE Standard Time",
        "tz_iana": "Europe/Zaporozhye"
    },
    {
        "tz_windows": "Israel Standard Time",
        "tz_iana": "Asia/Jerusalem"
    },
    {
        "tz_windows": "Israel Standard Time",
        "tz_iana": "Asia/Jerusalem"
    },
    {
        "tz_windows": "South Sudan Standard Time",
        "tz_iana": "Africa/Juba"
    },
    {
        "tz_windows": "South Sudan Standard Time",
        "tz_iana": "Africa/Juba"
    },
    {
        "tz_windows": "Kaliningrad Standard Time",
        "tz_iana": "Europe/Kaliningrad"
    },
    {
        "tz_windows": "Kaliningrad Standard Time",
        "tz_iana": "Europe/Kaliningrad"
    },
    {
        "tz_windows": "Sudan Standard Time",
        "tz_iana": "Africa/Khartoum"
    },
    {
        "tz_windows": "Sudan Standard Time",
        "tz_iana": "Africa/Khartoum"
    },
    {
        "tz_windows": "Libya Standard Time",
        "tz_iana": "Africa/Tripoli"
    },
    {
        "tz_windows": "Libya Standard Time",
        "tz_iana": "Africa/Tripoli"
    },
    {
        "tz_windows": "Namibia Standard Time",
        "tz_iana": "Africa/Windhoek"
    },
    {
        "tz_windows": "Namibia Standard Time",
        "tz_iana": "Africa/Windhoek"
    },
    {
        "tz_windows": "Arabic Standard Time",
        "tz_iana": "Asia/Baghdad"
    },
    {
        "tz_windows": "Arabic Standard Time",
        "tz_iana": "Asia/Baghdad"
    },
    {
        "tz_windows": "Turkey Standard Time",
        "tz_iana": "Europe/Istanbul"
    },
    {
        "tz_windows": "Turkey Standard Time",
        "tz_iana": "Europe/Istanbul"
    },
    {
        "tz_windows": "Arab Standard Time",
        "tz_iana": "Asia/Riyadh"
    },
    {
        "tz_windows": "Arab Standard Time",
        "tz_iana": "Asia/Bahrain"
    },
    {
        "tz_windows": "Arab Standard Time",
        "tz_iana": "Asia/Kuwait"
    },
    {
        "tz_windows": "Arab Standard Time",
        "tz_iana": "Asia/Qatar"
    },
    {
        "tz_windows": "Arab Standard Time",
        "tz_iana": "Asia/Riyadh"
    },
    {
        "tz_windows": "Arab Standard Time",
        "tz_iana": "Asia/Aden"
    },
    {
        "tz_windows": "Belarus Standard Time",
        "tz_iana": "Europe/Minsk"
    },
    {
        "tz_windows": "Belarus Standard Time",
        "tz_iana": "Europe/Minsk"
    },
    {
        "tz_windows": "Russian Standard Time",
        "tz_iana": "Europe/Moscow"
    },
    {
        "tz_windows": "Russian Standard Time",
        "tz_iana": "Europe/Moscow"
    },
    {
        "tz_windows": "Russian Standard Time",
        "tz_iana": "Europe/Kirov"
    },
    {
        "tz_windows": "Russian Standard Time",
        "tz_iana": "Europe/Simferopol"
    },
    {
        "tz_windows": "E. Africa Standard Time",
        "tz_iana": "Africa/Nairobi"
    },
    {
        "tz_windows": "E. Africa Standard Time",
        "tz_iana": "Antarctica/Syowa"
    },
    {
        "tz_windows": "E. Africa Standard Time",
        "tz_iana": "Africa/Djibouti"
    },
    {
        "tz_windows": "E. Africa Standard Time",
        "tz_iana": "Africa/Asmera"
    },
    {
        "tz_windows": "E. Africa Standard Time",
        "tz_iana": "Africa/Addis_Ababa"
    },
    {
        "tz_windows": "E. Africa Standard Time",
        "tz_iana": "Africa/Nairobi"
    },
    {
        "tz_windows": "E. Africa Standard Time",
        "tz_iana": "Indian/Comoro"
    },
    {
        "tz_windows": "E. Africa Standard Time",
        "tz_iana": "Indian/Antananarivo"
    },
    {
        "tz_windows": "E. Africa Standard Time",
        "tz_iana": "Africa/Mogadishu"
    },
    {
        "tz_windows": "E. Africa Standard Time",
        "tz_iana": "Africa/Dar_es_Salaam"
    },
    {
        "tz_windows": "E. Africa Standard Time",
        "tz_iana": "Africa/Kampala"
    },
    {
        "tz_windows": "E. Africa Standard Time",
        "tz_iana": "Indian/Mayotte"
    },
    {
        "tz_windows": "E. Africa Standard Time",
        "tz_iana": "Etc/GMT-3"
    },
    {
        "tz_windows": "Iran Standard Time",
        "tz_iana": "Asia/Tehran"
    },
    {
        "tz_windows": "Iran Standard Time",
        "tz_iana": "Asia/Tehran"
    },
    {
        "tz_windows": "Arabian Standard Time",
        "tz_iana": "Asia/Dubai"
    },
    {
        "tz_windows": "Arabian Standard Time",
        "tz_iana": "Asia/Dubai"
    },
    {
        "tz_windows": "Arabian Standard Time",
        "tz_iana": "Asia/Muscat"
    },
    {
        "tz_windows": "Arabian Standard Time",
        "tz_iana": "Etc/GMT-4"
    },
    {
        "tz_windows": "Astrakhan Standard Time",
        "tz_iana": "Europe/Astrakhan"
    },
    {
        "tz_windows": "Astrakhan Standard Time",
        "tz_iana": "Europe/Astrakhan"
    },
    {
        "tz_windows": "Astrakhan Standard Time",
        "tz_iana": "Europe/Ulyanovsk"
    },
    {
        "tz_windows": "Azerbaijan Standard Time",
        "tz_iana": "Asia/Baku"
    },
    {
        "tz_windows": "Azerbaijan Standard Time",
        "tz_iana": "Asia/Baku"
    },
    {
        "tz_windows": "Russia Time Zone 3",
        "tz_iana": "Europe/Samara"
    },
    {
        "tz_windows": "Russia Time Zone 3",
        "tz_iana": "Europe/Samara"
    },
    {
        "tz_windows": "Mauritius Standard Time",
        "tz_iana": "Indian/Mauritius"
    },
    {
        "tz_windows": "Mauritius Standard Time",
        "tz_iana": "Indian/Mauritius"
    },
    {
        "tz_windows": "Mauritius Standard Time",
        "tz_iana": "Indian/Reunion"
    },
    {
        "tz_windows": "Mauritius Standard Time",
        "tz_iana": "Indian/Mahe"
    },
    {
        "tz_windows": "Saratov Standard Time",
        "tz_iana": "Europe/Saratov"
    },
    {
        "tz_windows": "Saratov Standard Time",
        "tz_iana": "Europe/Saratov"
    },
    {
        "tz_windows": "Georgian Standard Time",
        "tz_iana": "Asia/Tbilisi"
    },
    {
        "tz_windows": "Georgian Standard Time",
        "tz_iana": "Asia/Tbilisi"
    },
    {
        "tz_windows": "Volgograd Standard Time",
        "tz_iana": "Europe/Volgograd"
    },
    {
        "tz_windows": "Volgograd Standard Time",
        "tz_iana": "Europe/Volgograd"
    },
    {
        "tz_windows": "Caucasus Standard Time",
        "tz_iana": "Asia/Yerevan"
    },
    {
        "tz_windows": "Caucasus Standard Time",
        "tz_iana": "Asia/Yerevan"
    },
    {
        "tz_windows": "Afghanistan Standard Time",
        "tz_iana": "Asia/Kabul"
    },
    {
        "tz_windows": "Afghanistan Standard Time",
        "tz_iana": "Asia/Kabul"
    },
    {
        "tz_windows": "West Asia Standard Time",
        "tz_iana": "Asia/Tashkent"
    },
    {
        "tz_windows": "West Asia Standard Time",
        "tz_iana": "Antarctica/Mawson"
    },
    {
        "tz_windows": "West Asia Standard Time",
        "tz_iana": "Asia/Oral"
    },
    {
        "tz_windows": "West Asia Standard Time",
        "tz_iana": "Asia/Aqtau"
    },
    {
        "tz_windows": "West Asia Standard Time",
        "tz_iana": "Asia/Aqtobe"
    },
    {
        "tz_windows": "West Asia Standard Time",
        "tz_iana": "Asia/Atyrau"
    },
    {
        "tz_windows": "West Asia Standard Time",
        "tz_iana": "Indian/Maldives"
    },
    {
        "tz_windows": "West Asia Standard Time",
        "tz_iana": "Indian/Kerguelen"
    },
    {
        "tz_windows": "West Asia Standard Time",
        "tz_iana": "Asia/Dushanbe"
    },
    {
        "tz_windows": "West Asia Standard Time",
        "tz_iana": "Asia/Ashgabat"
    },
    {
        "tz_windows": "West Asia Standard Time",
        "tz_iana": "Asia/Tashkent"
    },
    {
        "tz_windows": "West Asia Standard Time",
        "tz_iana": "Asia/Samarkand"
    },
    {
        "tz_windows": "West Asia Standard Time",
        "tz_iana": "Etc/GMT-5"
    },
    {
        "tz_windows": "Ekaterinburg Standard Time",
        "tz_iana": "Asia/Yekaterinburg"
    },
    {
        "tz_windows": "Ekaterinburg Standard Time",
        "tz_iana": "Asia/Yekaterinburg"
    },
    {
        "tz_windows": "Pakistan Standard Time",
        "tz_iana": "Asia/Karachi"
    },
    {
        "tz_windows": "Pakistan Standard Time",
        "tz_iana": "Asia/Karachi"
    },
    {
        "tz_windows": "Qyzylorda Standard Time",
        "tz_iana": "Asia/Qyzylorda"
    },
    {
        "tz_windows": "Qyzylorda Standard Time",
        "tz_iana": "Asia/Qyzylorda"
    },
    {
        "tz_windows": "India Standard Time",
        "tz_iana": "Asia/Calcutta"
    },
    {
        "tz_windows": "India Standard Time",
        "tz_iana": "Asia/Calcutta"
    },
    {
        "tz_windows": "Sri Lanka Standard Time",
        "tz_iana": "Asia/Colombo"
    },
    {
        "tz_windows": "Sri Lanka Standard Time",
        "tz_iana": "Asia/Colombo"
    },
    {
        "tz_windows": "Nepal Standard Time",
        "tz_iana": "Asia/Katmandu"
    },
    {
        "tz_windows": "Nepal Standard Time",
        "tz_iana": "Asia/Katmandu"
    },
    {
        "tz_windows": "Central Asia Standard Time",
        "tz_iana": "Asia/Almaty"
    },
    {
        "tz_windows": "Central Asia Standard Time",
        "tz_iana": "Antarctica/Vostok"
    },
    {
        "tz_windows": "Central Asia Standard Time",
        "tz_iana": "Asia/Urumqi"
    },
    {
        "tz_windows": "Central Asia Standard Time",
        "tz_iana": "Indian/Chagos"
    },
    {
        "tz_windows": "Central Asia Standard Time",
        "tz_iana": "Asia/Bishkek"
    },
    {
        "tz_windows": "Central Asia Standard Time",
        "tz_iana": "Asia/Almaty"
    },
    {
        "tz_windows": "Central Asia Standard Time",
        "tz_iana": "Asia/Qostanay"
    },
    {
        "tz_windows": "Central Asia Standard Time",
        "tz_iana": "Etc/GMT-6"
    },
    {
        "tz_windows": "Bangladesh Standard Time",
        "tz_iana": "Asia/Dhaka"
    },
    {
        "tz_windows": "Bangladesh Standard Time",
        "tz_iana": "Asia/Dhaka"
    },
    {
        "tz_windows": "Bangladesh Standard Time",
        "tz_iana": "Asia/Thimphu"
    },
    {
        "tz_windows": "Omsk Standard Time",
        "tz_iana": "Asia/Omsk"
    },
    {
        "tz_windows": "Omsk Standard Time",
        "tz_iana": "Asia/Omsk"
    },
    {
        "tz_windows": "Myanmar Standard Time",
        "tz_iana": "Asia/Rangoon"
    },
    {
        "tz_windows": "Myanmar Standard Time",
        "tz_iana": "Indian/Cocos"
    },
    {
        "tz_windows": "Myanmar Standard Time",
        "tz_iana": "Asia/Rangoon"
    },
    {
        "tz_windows": "SE Asia Standard Time",
        "tz_iana": "Asia/Bangkok"
    },
    {
        "tz_windows": "SE Asia Standard Time",
        "tz_iana": "Antarctica/Davis"
    },
    {
        "tz_windows": "SE Asia Standard Time",
        "tz_iana": "Indian/Christmas"
    },
    {
        "tz_windows": "SE Asia Standard Time",
        "tz_iana": "Asia/Jakarta"
    },
    {
        "tz_windows": "SE Asia Standard Time",
        "tz_iana": "Asia/Pontianak"
    },
    {
        "tz_windows": "SE Asia Standard Time",
        "tz_iana": "Asia/Phnom_Penh"
    },
    {
        "tz_windows": "SE Asia Standard Time",
        "tz_iana": "Asia/Vientiane"
    },
    {
        "tz_windows": "SE Asia Standard Time",
        "tz_iana": "Asia/Bangkok"
    },
    {
        "tz_windows": "SE Asia Standard Time",
        "tz_iana": "Asia/Saigon"
    },
    {
        "tz_windows": "SE Asia Standard Time",
        "tz_iana": "Etc/GMT-7"
    },
    {
        "tz_windows": "Altai Standard Time",
        "tz_iana": "Asia/Barnaul"
    },
    {
        "tz_windows": "Altai Standard Time",
        "tz_iana": "Asia/Barnaul"
    },
    {
        "tz_windows": "W. Mongolia Standard Time",
        "tz_iana": "Asia/Hovd"
    },
    {
        "tz_windows": "W. Mongolia Standard Time",
        "tz_iana": "Asia/Hovd"
    },
    {
        "tz_windows": "North Asia Standard Time",
        "tz_iana": "Asia/Krasnoyarsk"
    },
    {
        "tz_windows": "North Asia Standard Time",
        "tz_iana": "Asia/Krasnoyarsk"
    },
    {
        "tz_windows": "North Asia Standard Time",
        "tz_iana": "Asia/Novokuznetsk"
    },
    {
        "tz_windows": "N. Central Asia Standard Time",
        "tz_iana": "Asia/Novosibirsk"
    },
    {
        "tz_windows": "N. Central Asia Standard Time",
        "tz_iana": "Asia/Novosibirsk"
    },
    {
        "tz_windows": "Tomsk Standard Time",
        "tz_iana": "Asia/Tomsk"
    },
    {
        "tz_windows": "Tomsk Standard Time",
        "tz_iana": "Asia/Tomsk"
    },
    {
        "tz_windows": "China Standard Time",
        "tz_iana": "Asia/Shanghai"
    },
    {
        "tz_windows": "China Standard Time",
        "tz_iana": "Asia/Shanghai"
    },
    {
        "tz_windows": "China Standard Time",
        "tz_iana": "Asia/Hong_Kong"
    },
    {
        "tz_windows": "China Standard Time",
        "tz_iana": "Asia/Macau"
    },
    {
        "tz_windows": "North Asia East Standard Time",
        "tz_iana": "Asia/Irkutsk"
    },
    {
        "tz_windows": "North Asia East Standard Time",
        "tz_iana": "Asia/Irkutsk"
    },
    {
        "tz_windows": "Singapore Standard Time",
        "tz_iana": "Asia/Singapore"
    },
    {
        "tz_windows": "Singapore Standard Time",
        "tz_iana": "Asia/Brunei"
    },
    {
        "tz_windows": "Singapore Standard Time",
        "tz_iana": "Asia/Makassar"
    },
    {
        "tz_windows": "Singapore Standard Time",
        "tz_iana": "Asia/Kuching"
    },
    {
        "tz_windows": "Singapore Standard Time",
        "tz_iana": "Asia/Kuala_Lumpur"
    },
    {
        "tz_windows": "Singapore Standard Time",
        "tz_iana": "Asia/Manila"
    },
    {
        "tz_windows": "Singapore Standard Time",
        "tz_iana": "Asia/Singapore"
    },
    {
        "tz_windows": "Singapore Standard Time",
        "tz_iana": "Etc/GMT-8"
    },
    {
        "tz_windows": "W. Australia Standard Time",
        "tz_iana": "Australia/Perth"
    },
    {
        "tz_windows": "W. Australia Standard Time",
        "tz_iana": "Australia/Perth"
    },
    {
        "tz_windows": "Taipei Standard Time",
        "tz_iana": "Asia/Taipei"
    },
    {
        "tz_windows": "Taipei Standard Time",
        "tz_iana": "Asia/Taipei"
    },
    {
        "tz_windows": "Ulaanbaatar Standard Time",
        "tz_iana": "Asia/Ulaanbaatar"
    },
    {
        "tz_windows": "Ulaanbaatar Standard Time",
        "tz_iana": "Asia/Ulaanbaatar"
    },
    {
        "tz_windows": "Ulaanbaatar Standard Time",
        "tz_iana": "Asia/Choibalsan"
    },
    {
        "tz_windows": "Aus Central W. Standard Time",
        "tz_iana": "Australia/Eucla"
    },
    {
        "tz_windows": "Aus Central W. Standard Time",
        "tz_iana": "Australia/Eucla"
    },
    {
        "tz_windows": "Transbaikal Standard Time",
        "tz_iana": "Asia/Chita"
    },
    {
        "tz_windows": "Transbaikal Standard Time",
        "tz_iana": "Asia/Chita"
    },
    {
        "tz_windows": "Tokyo Standard Time",
        "tz_iana": "Asia/Tokyo"
    },
    {
        "tz_windows": "Tokyo Standard Time",
        "tz_iana": "Asia/Jayapura"
    },
    {
        "tz_windows": "Tokyo Standard Time",
        "tz_iana": "Asia/Tokyo"
    },
    {
        "tz_windows": "Tokyo Standard Time",
        "tz_iana": "Pacific/Palau"
    },
    {
        "tz_windows": "Tokyo Standard Time",
        "tz_iana": "Asia/Dili"
    },
    {
        "tz_windows": "Tokyo Standard Time",
        "tz_iana": "Etc/GMT-9"
    },
    {
        "tz_windows": "North Korea Standard Time",
        "tz_iana": "Asia/Pyongyang"
    },
    {
        "tz_windows": "North Korea Standard Time",
        "tz_iana": "Asia/Pyongyang"
    },
    {
        "tz_windows": "Korea Standard Time",
        "tz_iana": "Asia/Seoul"
    },
    {
        "tz_windows": "Korea Standard Time",
        "tz_iana": "Asia/Seoul"
    },
    {
        "tz_windows": "Yakutsk Standard Time",
        "tz_iana": "Asia/Yakutsk"
    },
    {
        "tz_windows": "Yakutsk Standard Time",
        "tz_iana": "Asia/Yakutsk"
    },
    {
        "tz_windows": "Yakutsk Standard Time",
        "tz_iana": "Asia/Khandyga"
    },
    {
        "tz_windows": "Cen. Australia Standard Time",
        "tz_iana": "Australia/Adelaide"
    },
    {
        "tz_windows": "Cen. Australia Standard Time",
        "tz_iana": "Australia/Adelaide"
    },
    {
        "tz_windows": "Cen. Australia Standard Time",
        "tz_iana": "Australia/Broken_Hill"
    },
    {
        "tz_windows": "AUS Central Standard Time",
        "tz_iana": "Australia/Darwin"
    },
    {
        "tz_windows": "AUS Central Standard Time",
        "tz_iana": "Australia/Darwin"
    },
    {
        "tz_windows": "E. Australia Standard Time",
        "tz_iana": "Australia/Brisbane"
    },
    {
        "tz_windows": "E. Australia Standard Time",
        "tz_iana": "Australia/Brisbane"
    },
    {
        "tz_windows": "E. Australia Standard Time",
        "tz_iana": "Australia/Lindeman"
    },
    {
        "tz_windows": "AUS Eastern Standard Time",
        "tz_iana": "Australia/Sydney"
    },
    {
        "tz_windows": "AUS Eastern Standard Time",
        "tz_iana": "Australia/Sydney"
    },
    {
        "tz_windows": "AUS Eastern Standard Time",
        "tz_iana": "Australia/Melbourne"
    },
    {
        "tz_windows": "West Pacific Standard Time",
        "tz_iana": "Pacific/Port_Moresby"
    },
    {
        "tz_windows": "West Pacific Standard Time",
        "tz_iana": "Antarctica/DumontDUrville"
    },
    {
        "tz_windows": "West Pacific Standard Time",
        "tz_iana": "Pacific/Truk"
    },
    {
        "tz_windows": "West Pacific Standard Time",
        "tz_iana": "Pacific/Guam"
    },
    {
        "tz_windows": "West Pacific Standard Time",
        "tz_iana": "Pacific/Saipan"
    },
    {
        "tz_windows": "West Pacific Standard Time",
        "tz_iana": "Pacific/Port_Moresby"
    },
    {
        "tz_windows": "West Pacific Standard Time",
        "tz_iana": "Etc/GMT-10"
    },
    {
        "tz_windows": "Tasmania Standard Time",
        "tz_iana": "Australia/Hobart"
    },
    {
        "tz_windows": "Tasmania Standard Time",
        "tz_iana": "Australia/Hobart"
    },
    {
        "tz_windows": "Tasmania Standard Time",
        "tz_iana": "Australia/Currie"
    },
    {
        "tz_windows": "Tasmania Standard Time",
        "tz_iana": "Antarctica/Macquarie"
    },
    {
        "tz_windows": "Vladivostok Standard Time",
        "tz_iana": "Asia/Vladivostok"
    },
    {
        "tz_windows": "Vladivostok Standard Time",
        "tz_iana": "Asia/Vladivostok"
    },
    {
        "tz_windows": "Vladivostok Standard Time",
        "tz_iana": "Asia/Ust-Nera"
    },
    {
        "tz_windows": "Lord Howe Standard Time",
        "tz_iana": "Australia/Lord_Howe"
    },
    {
        "tz_windows": "Lord Howe Standard Time",
        "tz_iana": "Australia/Lord_Howe"
    },
    {
        "tz_windows": "Bougainville Standard Time",
        "tz_iana": "Pacific/Bougainville"
    },
    {
        "tz_windows": "Bougainville Standard Time",
        "tz_iana": "Pacific/Bougainville"
    },
    {
        "tz_windows": "Russia Time Zone 10",
        "tz_iana": "Asia/Srednekolymsk"
    },
    {
        "tz_windows": "Russia Time Zone 10",
        "tz_iana": "Asia/Srednekolymsk"
    },
    {
        "tz_windows": "Magadan Standard Time",
        "tz_iana": "Asia/Magadan"
    },
    {
        "tz_windows": "Magadan Standard Time",
        "tz_iana": "Asia/Magadan"
    },
    {
        "tz_windows": "Norfolk Standard Time",
        "tz_iana": "Pacific/Norfolk"
    },
    {
        "tz_windows": "Norfolk Standard Time",
        "tz_iana": "Pacific/Norfolk"
    },
    {
        "tz_windows": "Sakhalin Standard Time",
        "tz_iana": "Asia/Sakhalin"
    },
    {
        "tz_windows": "Sakhalin Standard Time",
        "tz_iana": "Asia/Sakhalin"
    },
    {
        "tz_windows": "Central Pacific Standard Time",
        "tz_iana": "Pacific/Guadalcanal"
    },
    {
        "tz_windows": "Central Pacific Standard Time",
        "tz_iana": "Antarctica/Casey"
    },
    {
        "tz_windows": "Central Pacific Standard Time",
        "tz_iana": "Pacific/Ponape"
    },
    {
        "tz_windows": "Central Pacific Standard Time",
        "tz_iana": "Pacific/Kosrae"
    },
    {
        "tz_windows": "Central Pacific Standard Time",
        "tz_iana": "Pacific/Noumea"
    },
    {
        "tz_windows": "Central Pacific Standard Time",
        "tz_iana": "Pacific/Guadalcanal"
    },
    {
        "tz_windows": "Central Pacific Standard Time",
        "tz_iana": "Pacific/Efate"
    },
    {
        "tz_windows": "Central Pacific Standard Time",
        "tz_iana": "Etc/GMT-11"
    },
    {
        "tz_windows": "Russia Time Zone 11",
        "tz_iana": "Asia/Kamchatka"
    },
    {
        "tz_windows": "Russia Time Zone 11",
        "tz_iana": "Asia/Kamchatka"
    },
    {
        "tz_windows": "Russia Time Zone 11",
        "tz_iana": "Asia/Anadyr"
    },
    {
        "tz_windows": "New Zealand Standard Time",
        "tz_iana": "Pacific/Auckland"
    },
    {
        "tz_windows": "New Zealand Standard Time",
        "tz_iana": "Antarctica/McMurdo"
    },
    {
        "tz_windows": "New Zealand Standard Time",
        "tz_iana": "Pacific/Auckland"
    },
    {
        "tz_windows": "UTC+12",
        "tz_iana": "Etc/GMT-12"
    },
    {
        "tz_windows": "UTC+12",
        "tz_iana": "Pacific/Tarawa"
    },
    {
        "tz_windows": "UTC+12",
        "tz_iana": "Pacific/Majuro"
    },
    {
        "tz_windows": "UTC+12",
        "tz_iana": "Pacific/Kwajalein"
    },
    {
        "tz_windows": "UTC+12",
        "tz_iana": "Pacific/Nauru"
    },
    {
        "tz_windows": "UTC+12",
        "tz_iana": "Pacific/Funafuti"
    },
    {
        "tz_windows": "UTC+12",
        "tz_iana": "Pacific/Wake"
    },
    {
        "tz_windows": "UTC+12",
        "tz_iana": "Pacific/Wallis"
    },
    {
        "tz_windows": "UTC+12",
        "tz_iana": "Etc/GMT-12"
    },
    {
        "tz_windows": "Fiji Standard Time",
        "tz_iana": "Pacific/Fiji"
    },
    {
        "tz_windows": "Fiji Standard Time",
        "tz_iana": "Pacific/Fiji"
    },
    {
        "tz_windows": "Chatham Islands Standard Time",
        "tz_iana": "Pacific/Chatham"
    },
    {
        "tz_windows": "Chatham Islands Standard Time",
        "tz_iana": "Pacific/Chatham"
    },
    {
        "tz_windows": "UTC+13",
        "tz_iana": "Etc/GMT-13"
    },
    {
        "tz_windows": "UTC+13",
        "tz_iana": "Pacific/Enderbury"
    },
    {
        "tz_windows": "UTC+13",
        "tz_iana": "Pacific/Fakaofo"
    },
    {
        "tz_windows": "UTC+13",
        "tz_iana": "Etc/GMT-13"
    },
    {
        "tz_windows": "Tonga Standard Time",
        "tz_iana": "Pacific/Tongatapu"
    },
    {
        "tz_windows": "Tonga Standard Time",
        "tz_iana": "Pacific/Tongatapu"
    },
    {
        "tz_windows": "Samoa Standard Time",
        "tz_iana": "Pacific/Apia"
    },
    {
        "tz_windows": "Samoa Standard Time",
        "tz_iana": "Pacific/Apia"
    },
    {
        "tz_windows": "Line Islands Standard Time",
        "tz_iana": "Pacific/Kiritimati"
    },
    {
        "tz_windows": "Line Islands Standard Time",
        "tz_iana": "Pacific/Kiritimati"
    },
    {
        "tz_windows": "Line Islands Standard Time",
        "tz_iana": "Etc/GMT-14"
    }
];

module.exports = timezoneMapper;
