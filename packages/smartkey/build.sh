#!/bin/bash
# Builds the CE SmartKeyService (com.palm.smartKey) for the TouchPad: openwebos/smartkey-hun's
# service shell at a pinned commit + patches/smartkey-hun-ce.patch + this package's engine/.
#
#   packages/smartkey/build.sh      -> build/work/smartkey/stage/ (the files, at device paths)
#
# Toolchain and libraries are LunaCE's: PalmPDK gcc 4.3.3 (/opt/PalmPDK/arm-gcc, the device's
# own libstdc++ ABI) against the staging tree LunaCE builds with (STAGING, default
# ../lunace-build/staging/armv7). The binary links only what stock 3.0.5 already ships
# (liblunaservice, cjson, glib, libhunspell-1.3); Hunspell through its C API.
#
# Dictionaries: AOSP LatinIME wordlists (Apache-2.0) -> .skd per language, and smartkey-hun's
# Hunspell .aff/.dic + DefaultData (whitelists, autoreplace, manufacturer words).
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
W=${W:-$ROOT/build/work/smartkey}
STAGING=${STAGING:-$ROOT/../lunace-build/staging/armv7}
TC=${TC:-/opt/PalmPDK/arm-gcc/bin/arm-none-linux-gnueabi-}
SKH_COMMIT=91ac160b990619a3406e9615cc3b781f5cabf70b
HUN_VER=1.3.4
AOSP=https://android.googlesource.com/platform/packages/inputmethods/LatinIME/+/refs/heads/main/dictionaries
# input language -> AOSP wordlist, Hunspell dictionary in smartkey-hun's DefaultData/hunspell
LANGS="en:en_US:en_US de:de:de_AT fr:fr:fr es:es:es_ES it:it:-"   # smartkey-hun has no de_DE (dangling links)
MINFREQ=${MINFREQ:-40}   # rarer words: no measurable loss (eval.py), 40% smaller

[ -x "${TC}g++" ] || { echo "toolchain not found: ${TC}g++" >&2; exit 1; }
[ -d "$STAGING/usr/include" ] || { echo "staging tree not found: $STAGING" >&2; exit 1; }
mkdir -p "$W/src" "$W/obj" "$W/inc/hunspell" "$W/dl"

# ---- sources ---------------------------------------------------------------------------------
cd "$W/src"
if [ ! -d smartkey-hun ]; then
    git clone -q https://github.com/openwebos/smartkey-hun smartkey-hun
fi
git -C smartkey-hun checkout -q -f "$SKH_COMMIT"
git -C smartkey-hun apply "$HERE/patches/smartkey-hun-ce.patch"
if [ ! -d hunspell-$HUN_VER ]; then
    curl -sSfL -o hunspell.tgz https://github.com/hunspell/hunspell/archive/refs/tags/v$HUN_VER.tar.gz
    tar xzf hunspell.tgz
fi
# only the C API header is used; it matches the device's libhunspell-1.3 exports
cp hunspell-$HUN_VER/src/hunspell/hunspell.h "$W/inc/hunspell/"
sed 's/@HAVE_VISIBILITY@/1/' hunspell-$HUN_VER/src/hunspell/hunvisapi.h.in > "$W/inc/hunspell/hunvisapi.h"

# ---- compile + link --------------------------------------------------------------------------
cd "$W/obj"
rm -f ./*.o
FLAGS="-O2 -march=armv7-a -mfpu=vfp -mfloat-abi=softfp -fno-strict-aliasing -Wno-deprecated
 -DSK_DICT_DIR=\"/usr/palm/smartkey/skd\"
 -I$HERE/engine -I$W/inc -I$STAGING/usr/include -I$STAGING/usr/include/glib-2.0
 -I$STAGING/usr/lib/glib-2.0/include -I$W/src/smartkey-hun/Src"
for f in "$W"/src/smartkey-hun/Src/*.cpp "$HERE"/engine/*.cpp; do
    b=$(basename "$f" .cpp)
    [ "$b" = SpellCheckClient ] && continue     # the pbnjson client library, not the service
    ${TC}g++ $FLAGS -c "$f" -o "$b.o"
done
${TC}g++ -o SmartKeyService ./*.o -L"$STAGING/usr/lib" -L"$STAGING/lib" \
    -Wl,-rpath-link,"$STAGING/usr/lib" -Wl,-rpath-link,"$STAGING/lib" \
    -llunaservice -lcjson -lglib-2.0 -lgthread-2.0 -lhunspell-1.3 -lpthread -lrt
${TC}strip SmartKeyService
# the device has glibc 2.8 and libstdc++ GLIBCXX_3.4.10
bad=$(${TC}objdump -T SmartKeyService | grep -oE "GLIBC_2\.([9]|[1-9][0-9])|GLIBCXX_3\.4\.1[1-9]" | sort -u || true)
[ -z "$bad" ] || { echo "binary needs symbols the device lacks: $bad" >&2; exit 1; }

# ---- stage -----------------------------------------------------------------------------------
S="$W/stage"
rm -rf "$S"
mkdir -p "$S/usr/bin" "$S/usr/palm/smartkey/skd" "$S/usr/palm/smartkey/hunspell"
cp SmartKeyService "$S/usr/bin/SmartKeyService"
cp -r "$W/src/smartkey-hun/DefaultData" "$S/usr/palm/smartkey/DefaultData"
rm -rf "$S/usr/palm/smartkey/DefaultData/hunspell"
cp "$W/src/smartkey-hun/hunspell/basicGrammar.aff" "$S/usr/palm/smartkey/hunspell/"
for spec in $LANGS; do
    IFS=: read -r lang aosp hun <<< "$spec"
    gz="$W/dl/${aosp}_wordlist.combined.gz"
    [ -s "$gz" ] || curl -sSfL "$AOSP/${aosp}_wordlist.combined.gz?format=TEXT" | base64 -d > "$gz"
    python3 "$HERE/tools/build-skd.py" "$gz" "$S/usr/palm/smartkey/skd/$lang.skd" --min-freq "$MINFREQ"
    if [ "$hun" != - ]; then
        # staged as <lang>.aff/.dic: Settings::_findLocalResource falls back to the bare language
        cp "$W/src/smartkey-hun/DefaultData/hunspell/$hun.aff" "$S/usr/palm/smartkey/hunspell/$lang.aff"
        cp "$W/src/smartkey-hun/DefaultData/hunspell/$hun.dic" "$S/usr/palm/smartkey/hunspell/$lang.dic"
    fi
done
echo "staged in $S:"
( cd "$S" && du -sh usr/bin/SmartKeyService usr/palm/smartkey/* )
