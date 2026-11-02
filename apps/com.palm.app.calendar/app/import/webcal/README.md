# Parser from webos-webcal-synergy

These four `.js` files are unchanged copies from `service/javascript/utils/` in
https://github.com/webOSArchive/webos-webcal-synergy. That project is GPLv3 (`LICENSE.txt`), and
it came from `org.webosports.service.contacts.carddav`.

Keep them identical in both repos: a parser fix goes in both places, along with
`tests/iCalParserTest.js`, which is the same file in both. Nothing here loads at app start.
`../ICalEvents.js` evaluates them when an import starts, with the Node globals they expect passed
in as arguments, so nothing here reaches the app's global scope.
