# SmartKeyService, prebuilt

The output of `packages/smartkey/build.sh` at device paths. `build/full-ce/bake.py` (tier
"SmartKey") copies it into the image, so the bake stays offline. Rebuild with build.sh, copy
`build/work/smartkey/stage/` here, and commit both together.

- `usr/bin/SmartKeyService`: replaces the stock XT9 service (same name, bus id and API).
- `usr/palm/smartkey/skd/*.skd`: the correction dictionaries (en, de, fr, es, it).
- `usr/palm/smartkey/hunspell/`: Hunspell word lists.
- `usr/palm/smartkey/DefaultData/`: whitelists, auto-replace and manufacturer words.

The stock `usr/palm/smartkey/XT9/` stays in the image but is unused.
