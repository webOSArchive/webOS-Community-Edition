"""webOS CE edits to stock account templates under /usr/palm/public/accounts, and to
the accounts library's "get started" string.

Shared by bake.py (tier 11d) and by hand for a dev push to a device:

    python3 build/full-ce/account_templates.py <dir-holding-the-template-dirs>

rewrites the template JSON under <dir>/com.palm.{palmprofile,facebook,linkedin} in place.

Both edits are TEXT edits on purpose. The stock templates are not all valid JSON
(com.palm.palmprofile.json has a trailing comma inside its LOCAL.FILESTORAGE icon),
and the accounts service reads them with a lenient parser, so a parse-and-dump
round trip would fail on some files and reformat the rest.

1. com.palm.palmprofile: "HP webOS Account" -> "webOS Account". There is no HP
   account any more; CE's first-use creates a webOS Archive community account (or
   a local profile when sign-in is skipped). The account record in db8 does not
   store the name -- listAccounts annotates it from the template -- so this renames
   it on devices that are already set up, too. Every locale's phrase contains the
   literal "HP webOS" (HP webOS-Konto, Compte HP webOS, Cuenta de HP webOS, Account
   HP webOS), so dropping the vendor word reads correctly in all of them -- the
   same rule as the Device Info tier (11c).

2. com.palm.facebook: drop the CALENDAR and CONTACTS capability providers.
   Facebook's calendar and contacts APIs are long gone, so it offered syncs that
   can never work: the Calendar's and Contacts' first-launch and "add an account"
   lists, and the Accounts app, all build their choices from template capability
   providers. PHOTO.UPLOAD is left alone.

3. com.palm.linkedin: hidden. CONTACTS is its only capability and LinkedIn's
   contacts API is gone too. Dropping the provider would leave a template with
   none, so mark the template "hidden" instead -- the accounts library filters
   hidden templates out of every account list. The template still loads, so an
   old LinkedIn account restored from a backup still annotates.

The template's locale overrides (resources/<locale>/...) REPLACE the base file
rather than merging into it, so each edit applies to every file.

4. The accounts library (enyo lib/accounts) asks people to "Get started with your
   HP webOS account:" on first launch. Its string tables are keyed by that English
   phrase, so the KEY must stay as util.js spells it; only each table's value is
   de-branded ("HP webOS" -> "webOS", the same rule as 1).
"""
import os
import re
import sys

PALMPROFILE = "com.palm.palmprofile"
FACEBOOK = "com.palm.facebook"
LINKEDIN = "com.palm.linkedin"
GET_STARTED_KEY = '"Get started with your HP webOS account:"'

def _cap_re(cap):
    return re.compile(r'"capability"\s*:\s*"%s"' % re.escape(cap))


def debrand_palmprofile(text, what):
    """Rename the profile account; every locale's name carries "HP webOS"."""
    n = text.count("HP webOS")
    if n != 1:
        sys.exit(f"ERROR: {what}: expected exactly one \"HP webOS\", found {n}")
    return text.replace("HP webOS", "webOS")


def drop_provider(text, what, cap):
    """Remove the one capabilityProviders entry whose capability is cap."""
    cap_re = _cap_re(cap)
    hits = list(cap_re.finditer(text))
    if len(hits) != 1:
        sys.exit(f"ERROR: {what}: expected one {cap} capability provider, found {len(hits)}")
    pos = hits[0].start()
    start = text.rfind("{", 0, pos)
    depth, end = 0, None
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if start < 0 or end is None:
        sys.exit(f"ERROR: {what}: could not find the bounds of the {cap} provider")
    # The provider is an array element: take the comma that separates it from its
    # neighbour -- the one after it, or (if it was the last element) the one before.
    after = re.match(r"\s*,\s*", text[end:])
    if after:
        end += after.end()
    else:
        before = re.search(r",\s*$", text[:start])
        if not before:
            sys.exit(f"ERROR: {what}: {cap} provider is the only element; refusing to empty the array")
        start = before.start()
    out = text[:start] + text[end:]
    if cap_re.search(out) or '"capabilityProviders"' not in out:
        sys.exit(f"ERROR: {what}: {cap} provider removal left the template malformed")
    return out


def facebook(text, what):
    return drop_provider(drop_provider(text, what, "CALENDAR"), what, "CONTACTS")


def hide_template(text, what):
    """Mark a template hidden: insert "hidden": true as its first member."""
    if '"hidden"' in text or '"capabilityProviders"' not in text:
        sys.exit(f"ERROR: {what}: not a template this edit expects (already hidden?)")
    m = re.match(r"\s*\{", text)
    if not m:
        sys.exit(f"ERROR: {what}: does not start with an object")
    return text[:m.end()] + '\n\t"hidden": true,' + text[m.end():]


def debrand_get_started(text, what):
    """De-brand the value (never the key) of the library's "get started" string.

    Returns the text unchanged for a table without the string (es_es, fr_ca)."""
    out, n = [], 0
    for line in text.split("\n"):
        if line.lstrip().startswith(GET_STARTED_KEY):
            key, sep, value = line.partition(GET_STARTED_KEY)
            if "HP webOS" not in value:
                sys.exit(f"ERROR: {what}: \"get started\" value has no \"HP webOS\": {line.strip()}")
            line = key + sep + value.replace("HP webOS", "webOS")
            n += 1
        out.append(line)
    if n > 1:
        sys.exit(f"ERROR: {what}: \"get started\" key appears {n} times")
    return "\n".join(out)


EDITS = {PALMPROFILE: debrand_palmprofile, FACEBOOK: facebook, LINKEDIN: hide_template}


def edit(template_dir, relpath, text):
    """Apply the edit for the template that owns relpath (a path under template_dir)."""
    return EDITS[template_dir](text, relpath)


def main(root):
    done = 0
    for tdir in EDITS:
        for dirpath, _, files in os.walk(os.path.join(root, tdir)):
            for f in files:
                if not f.endswith(".json"):
                    continue
                p = os.path.join(dirpath, f)
                with open(p, encoding="utf-8") as fh:
                    text = fh.read()
                with open(p, "w", encoding="utf-8") as fh:
                    fh.write(edit(tdir, os.path.relpath(p, root), text))
                done += 1
    print(f"edited {done} template file(s)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
