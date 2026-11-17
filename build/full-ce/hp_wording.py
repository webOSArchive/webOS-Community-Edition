"""webOS CE: HP's name taken out of the wording people see.

HP is long gone from webOS, and CE's goal for 3.2.0 is that nothing on screen
still speaks for it. Two rules, the user's: "HP TouchPad" becomes "webOS
TouchPad", and elsewhere "HP" is dropped, so "HP webOS Account" becomes "webOS
Account". bake.py applies this module's tables to the apps as it builds the
image; nothing here is device-specific.

How an app's strings are changed
--------------------------------
An Enyo app looks a string up by its English text: $L("... HP TouchPad") finds
the entry keyed by that exact phrase in resources/<language>.json, then
resources/<language>_<region>.json. But for US English it does not look at all:
enyo.g11n returns the source string as it stands when the locale is the source
locale, en_us (resources.js, _$L). So a table edit alone, an en.json entry
included, changes nothing for the people most likely to be reading.

The phrase therefore changes on both sides at once. The source literal is
rewritten, and in every table the key is rewritten the same way and its value
de-branded:

    source:   $L("-- Sent from my HP TouchPad") -> $L("-- Sent from my webOS TouchPad")
    de.json:  "-- Sent from my HP TouchPad": "-- Gesendet von meinem HP TouchPad"
           -> "-- Sent from my webOS TouchPad": "-- Gesendet von meinem webOS TouchPad"

Because source and key get the same new text, every lookup still lands. A key
that is not found in the app's source is an error: the tables would be renamed
to match nothing.

(The accounts library's "Get started with your HP webOS account:" was first
done by value alone, which is why it never showed in US English. It is in the
table below now.)

Tables and sources are edited as text, pair by pair and literal by literal, so
every other line stays byte-identical.

The translated values are de-branded by the same rules as the English
(RULES below): each translation carries the literal "HP TouchPad", "HP webOS"
or "HP Synergy". A few strings need a sentence of their own in every language;
those are spelled out in the table as {file: text}. Translations written here
(Music's, where the HP Play clause had to go) want a native speaker's eye:
Docs/LOCALIZATION-GUIDE.md.

A value that still holds "HP" after the rules is an error, so a string the
rules do not cover cannot slip through half done.

What is deliberately not here
-----------------------------
- Export-control and payment errors from HP's dead servers ("The United States
  Government prohibits HP from ..."), which cannot be reworded by dropping a
  word and cannot be reached any more.
- Messages that send people to http://hpwebos.com/support: the link is dead and
  what should replace it is undecided.
- The "vendor" field of each appinfo.json, Help's Care Pack page, the App
  Catalog's terms, the first-use app, demo mode: each needs a decision that is
  not a wording rule.
- Copyright notices, printer detection, and names of real hardware.
"""
import json
import re

# Ordered: the first rules are the user's two; the rest are how each language
# attached "HP" to a noun that survives without it.
RULES = [
    (r"HP Touch[Pp]ad", "webOS TouchPad"),
    (r"HP WEBOS", "WEBOS"),
    (r"HP [Ww]ebOS", "webOS"),
    (r"HP Synergy", "Synergy"),
    (r"HP App Catalog", "App Catalog"),
    (r"App Catalog de HP", "App Catalog"),
    # "HP's Cloud Services"
    (r"HP's Cloud Services", "Cloud Services"),
    (r"Cloud Services von HP", "Cloud Services"),
    (r"servicios en la nube de HP", "servicios en la nube"),
    (r"services de nuage de HP", "services de nuage"),
    (r"Cloud Services di HP", "Cloud Services"),
    # "... it's not a HP device."  (pairing a phone that is not a webOS one)
    (r"an? HP device", "a webOS device"),
    (r"kein HP Gerät", "kein webOS-Gerät"),
    (r"dispositivo HP", "dispositivo webOS"),
    (r"appareil HP", "appareil webOS"),
    # "Report a problem with this application to HP."
    (r" to HP\.", "."),
    (r" an HP melden", " melden"),
    (r" a HP\.", "."),
    (r" à HP\.", "."),
    (r" ad HP ", " "),
]
_HP = re.compile(r"(?<![A-Za-z0-9_])HP(?![A-Za-z0-9_])|hpplay")


def debrand(text):
    """Apply RULES to one string."""
    for pat, new in RULES:
        text = re.sub(pat, new, text)
    return text


# One entry per app: {english phrase: None (use RULES) | {"en": new English,
# table file: new value, ...}}. A table that has the phrase but no entry of its
# own falls back to RULES, as does the English when "en" is not given.
_MUSIC_ADD = ("You can add music to your HP TouchPad with the HP Play music app, found at "
              "www.hpplay.com, or copy music to your HP TouchPad in USB mode.")

EMAIL = {
    "-- Sent from my HP TouchPad": None,
}
MUSIC = {
    "There are no songs on your HP TouchPad": None,
    # HP Play and hpplay.com are gone; what is left is the USB half.
    _MUSIC_ADD: {
        "en": "You can copy music to your webOS TouchPad in USB mode.",
        "de.json": "Sie können Songs im USB-Modus auf Ihr webOS TouchPad kopieren.",
        "es.json": "Puedes copiar música a tu webOS TouchPad en modo USB.",
        "fr.json": "Vous pouvez copier de la musique sur votre webOS TouchPad en mode USB.",
        "it.json": "È possibile copiare la musica su webOS TouchPad in modalità USB.",
    },
}
ACCOUNTS_APP = {
    "Must be connected to a network to communicate with HP's Cloud Services. "
    "Check your network connection, or try again later.": None,
    "Must be connected to a network to communicate with HP's Cloud Services. "
    "Check your network connection, or try again.": None,
}
ACCOUNTS_LIB = {
    "HP Synergy Services": None,
    "Calendar HP Synergy Services": None,
    "Documents HP Synergy Services": None,
    "Contacts HP Synergy Services": None,
    "Email HP Synergy Services": None,
    "Memos HP Synergy Services": None,
    "Messaging HP Synergy Services": None,
    "Phone HP Synergy Services": None,
    "Photo HP Synergy Services": None,
    "Tasks HP Synergy Services": None,
    # the tables' values were de-branded earlier; "Account" as CE's English has it
    "Get started with your HP webOS account:": {"en": "Get started with your webOS Account:"},
}
SYSTEMUI = {
    "This device can't be paired because it's not a HP device.": None,
}
SWMANAGER = {
    "Check out this HP webOS app": None,
    "Report a problem with this application to HP. Describe how to reproduce the problem.": None,
    "There is no payment information associated with your HP webOS Account. "
    "Tap Preferences in the App Menu to set it up.": None,
    "This is not a valid HP webOS application.": None,
    "We could not find a valid HP webOS Account.<br/>You need a valid account to use "
    "HP App Catalog.": None,
}

_PAIR = re.compile(r'"((?:[^"\\]|\\.)*)"(\s*:\s*)"((?:[^"\\]|\\.)*)"')


def _raw(s):
    return json.dumps(s, ensure_ascii=False)[1:-1]


def english(keys):
    """{old English phrase: new English phrase} for a table of keys."""
    out = {}
    for k, spec in keys.items():
        new = spec["en"] if spec and "en" in spec else debrand(k)
        if _HP.search(new):
            raise SystemExit(f"ERROR: English text still names HP: {new}")
        out[k] = new
    return out


def edit_table(text, keys, fname, what):
    """Rename `keys` in one string table (its text) and de-brand their values.
    Returns (new text, [keys found])."""
    names = english(keys)
    found = []

    def one(m):
        try:
            k = json.loads('"' + m.group(1) + '"')
            v = json.loads('"' + m.group(3) + '"')
        except ValueError:
            return m.group(0)
        if k not in keys:
            return m.group(0)
        spec = keys[k]
        new = spec[fname] if spec and fname in spec else debrand(v)
        if _HP.search(new):
            raise SystemExit(f"ERROR: {what}/{fname}: value still names HP after the rules:\n"
                             f"  key   {k}\n  value {new}")
        found.append(k)
        return '"%s"%s"%s"' % (_raw(names[k]), m.group(2), _raw(new))

    return _PAIR.sub(one, text), found


def edit_source(text, keys):
    """Rewrite the phrases where a source file spells them. Returns (new text,
    {phrase: times found}). A phrase is matched as written in a double-quoted
    literal, a single-quoted one, or bare."""
    counts = {}
    # longest first: "HP Synergy Services" is also the tail of nine longer phrases
    for k, new in sorted(english(keys).items(), key=lambda kv: -len(kv[0])):
        n = 0
        for old, rep in ((_raw(k), _raw(new)),
                         (k.replace("'", "\\'"), new.replace("'", "\\'")),
                         (k, new)):
            c = text.count(old)
            if c:
                text = text.replace(old, rep)
                n += c
        counts[k] = n
    return text, counts


def apply(tables, sources, keys, what):
    """tables: {file name: text} for the app's resources/*.json; sources:
    {path: text} for its .js files. Returns ({table name: new text},
    {source path: new text}) holding only what changes."""
    new_tables = {}
    for fname in sorted(tables):
        new, _found = edit_table(tables[fname], keys, fname, what)
        if new != tables[fname]:
            try:
                json.loads(new)
            except ValueError as e:
                raise SystemExit(f"ERROR: {what}/{fname}: not valid JSON after the edit: {e}")
            new_tables[fname] = new
    new_sources = {}
    total = dict.fromkeys(keys, 0)
    for path in sorted(sources):
        new, counts = edit_source(sources[path], keys)
        for k, n in counts.items():
            total[k] += n
        if new != sources[path]:
            new_sources[path] = new
    missing = [k for k, n in total.items() if not n]
    if missing:
        raise SystemExit(f"ERROR: HP wording: {what}: not found in the app's source: {missing}; "
                         f"the app changed, so look before renaming table keys to match nothing")
    return new_tables, new_sources


def read_tree(root, exts=(".js",)):
    """{relative path: text} for the files under root with one of exts."""
    import os
    out = {}
    for dp, _dn, fns in os.walk(root):
        for fn in fns:
            if fn.endswith(exts):
                p = os.path.join(dp, fn)
                with open(p, "rb") as f:
                    out[os.path.relpath(p, root)] = f.read().decode("utf-8")
    return out


def app_files(root):
    """(tables, sources) of an app tree on disk, as apply() wants them."""
    import os
    rd = os.path.join(root, "resources")
    tables = {}
    if os.path.isdir(rd):
        for n in sorted(os.listdir(rd)):
            if n.endswith(".json") and os.path.isfile(os.path.join(rd, n)):
                with open(os.path.join(rd, n), "rb") as f:
                    tables[n] = f.read().decode("utf-8")
    sources = {p: t for p, t in read_tree(root).items()
               if not p.startswith("resources" + os.sep)}
    return tables, sources


def edit_app(root, keys, what):
    """Apply `keys` to an app tree on disk, in place. Returns the paths changed."""
    import os
    tables, sources = app_files(root)
    new_tables, new_sources = apply(tables, sources, keys, what)
    changed = []
    for rel, text in ([(os.path.join("resources", n), t) for n, t in new_tables.items()]
                      + list(new_sources.items())):
        with open(os.path.join(root, rel), "wb") as f:
            f.write(text.encode("utf-8"))
        changed.append(rel)
    return sorted(changed)


def done(root, keys):
    """True when an app tree on disk no longer spells any of `keys`."""
    tables, sources = app_files(root)
    blob = "\n".join(list(tables.values()) + list(sources.values()))
    return not any(k in blob or _raw(k) in blob for k in keys)


def main():
    """Rewrite the accounts library under system/ (finished files that the
    image and other projects take; system/README.md)."""
    import os
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "system",
                        "usr/palm/frameworks/enyo/0.10/framework/lib/accounts")
    if done(root, ACCOUNTS_LIB):
        print("system/ accounts library: already done")
        return
    for rel in edit_app(root, ACCOUNTS_LIB, "accounts library"):
        print("rewrote", rel)


if __name__ == "__main__":
    main()
