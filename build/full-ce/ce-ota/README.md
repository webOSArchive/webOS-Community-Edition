# CE OTA trust anchor (baked into the image)

Two files, copied from `../../../webos-update-exploration` and vendored here so a
build does not depend on a sibling checkout:

| File | Baked to | Mode |
|------|----------|------|
| `ce-ota-signing.pub` | `/usr/share/ce-ota/keys/ce-ota-signing.pub` | 644 |
| `ce-ota-verify`      | `/usr/bin/ce-ota-verify`                    | 755 |

**Why these are in a GA image when nothing yet uses them.** A trust root cannot be
delivered over an untrusted channel: if the key shipped in a later update, that
update would itself be unauthenticated, which is the problem it exists to solve.
Everything else in the OTA client can arrive later via Preware and be authenticated
by this key. See `OTA-IMAGE-INTEGRATION.md` §1 and `IMAGE-SIDE-DECISIONS.md` §1 in
the OTA project; the signing design is in its `OTA-3.1.0.md` Part II and
`keys/README.md`.

RSA-4096, signatures SHA-256 PKCS#1 v1.5. Chosen for the stock OpenSSL 0.9.8k
(2009) at `/usr/bin/openssl` — which this image does NOT replace (our TLS work adds
`/usr/lib/ssl11` and wraps `curl`, leaving `openssl` stock), so the verifier works
identically on 3.0.5 and 3.1.0.

`bake.py` asserts the key's DER SubjectPublicKeyInfo fingerprint at build time. A
wrong or corrupted key fails the build rather than shipping.

The private half lives only on the signing host and is in neither repository.

## ce-ota-finish (added 2026-11-20)

| File | Baked to |
|------|----------|
| `ce-ota-finish.sh` | `/usr/share/ce-ota/ce-ota-finish.sh`, run by `/etc/event.d/ce-ota-finish` |
| `finish/from-<mark>.list` | `/usr/share/ce-ota/finish/` |

What an OTA cannot do from the update ramdisk: see the script's header and
`Docs/OTA-PLAN.md` §2.2. One list per image a device can come from, made with
`build/ota/make-payload.py finish-list <that image's JAR>`. Released images do
not change, so a list is made once.
