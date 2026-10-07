"""webOS CE edits to two stock account templates under /usr/palm/public/accounts.

Shared by bake.py (tier 11d) and by hand for a dev push to a device:

    python3 build/full-ce/account_templates.py <dir-holding-the-template-dirs>

rewrites the template JSON under <dir>/com.palm.palmprofile and <dir>/com.palm.facebook
in place.

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

2. com.palm.facebook: drop the CALENDAR capability provider. Facebook's calendar
   API is long gone, so it offered a calendar sync that can never work: the
   Calendar's first-launch and Preferences "add an account" lists, and the
   Accounts app, all build their choices from template capability providers.
   CONTACTS and PHOTO.UPLOAD are left alone -- this is the calendar clean-up only.
"""
import os
import re
import sys

PALMPROFILE = "com.palm.palmprofile"
FACEBOOK = "com.palm.facebook"

_CALENDAR_CAP = re.compile(r'"capability"\s*:\s*"CALENDAR"')


def debrand_palmprofile(text, what):
    """Rename the profile account; every locale's name carries "HP webOS"."""
    n = text.count("HP webOS")
    if n != 1:
        sys.exit(f"ERROR: {what}: expected exactly one \"HP webOS\", found {n}")
    return text.replace("HP webOS", "webOS")


def drop_calendar_provider(text, what):
    """Remove the one capabilityProviders entry whose capability is CALENDAR."""
    hits = list(_CALENDAR_CAP.finditer(text))
    if len(hits) != 1:
        sys.exit(f"ERROR: {what}: expected one CALENDAR capability provider, found {len(hits)}")
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
        sys.exit(f"ERROR: {what}: could not find the bounds of the CALENDAR provider")
    # The provider is an array element: take the comma that separates it from its
    # neighbour -- the one after it, or (if it was the last element) the one before.
    after = re.match(r"\s*,\s*", text[end:])
    if after:
        end += after.end()
    else:
        before = re.search(r",\s*$", text[:start])
        if not before:
            sys.exit(f"ERROR: {what}: CALENDAR provider is the only element; refusing to empty the array")
        start = before.start()
    out = text[:start] + text[end:]
    if _CALENDAR_CAP.search(out) or '"capabilityProviders"' not in out:
        sys.exit(f"ERROR: {what}: CALENDAR provider removal left the template malformed")
    return out


EDITS = {PALMPROFILE: debrand_palmprofile, FACEBOOK: drop_calendar_provider}


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
