#!/usr/bin/env python3
"""A fifth WebKit fallback font: the libWebKitLuna code-cave patch (Docs/EMOJI-FONT.md §4).

    webkit_fallback_patch.py <in libWebKitLuna.so> <out> [font path]

Also imported by bake.py (patch()). PGFallbackFonts::init() loads four hard-coded CJK
fallback fonts; the object has room for eight. This adds a fifth load, of FONT, right after
the fourth: the `bl PGContext::create@plt` that follows the loads becomes `bl cave`, and the
cave loads the font exactly as init loads the others, then tail-calls PGContext::create.

Refuses any input but the one it was written against (stock 3.0.5 + bake tier 19b's two byte
patches), and asserts every byte it relies on. If the font file is missing at run time,
createFromFile returns NULL and nothing changes: deleting the font switches the patch off.
"""
import hashlib, struct, sys

INPUT_MD5 = '0a44935bc6c53a1ed535039aef153fc7'   # bake tier 19b output (CE 3.1.0 / 3.2.0)
FONT = '/usr/share/fonts/CE-Emoji.ttf'

CALL_AT = 0x5bf080            # in PGFallbackFonts::init: bl PGContext::create@plt
PLT_CONTEXT_CREATE = 0x87964
PLT_CREATE_FROM_FILE = 0x89db8   # what init's four loads call
CAVE = 0x89ac30               # end of the R+X PT_LOAD; zeros up to the RW segment at 0x89b000
CAVE_END = 0x89b000
# the stock code around CALL_AT that the cave depends on (r7 = this, r9 = per-font flag):
EXPECT = {
    0x5bf070: 0x15c29034,     # strbne r9, [r2, #52]   (the fourth load's flag)
    0x5bf074: 0x15972000,     # ldrne  r2, [r7]        (count)
    0x5bf078: 0x12822001,     # addne  r2, r2, #1
    0x5bf07c: 0x15872000,     # strne  r2, [r7]
    0x5bf064: 0xe28d4004,     # add    r4, sp, #4      (r4 is live after the call: saved)
}


def bl(at, target, cond=0xE):
    off = (target - (at + 8)) >> 2
    assert -(1 << 23) <= off < (1 << 23)
    return (cond << 28) | (0b1011 << 24) | (off & 0xFFFFFF)


def b(at, target):
    return bl(at, target) & ~(1 << 24)


def cave_code(font):
    path = font.encode() + b'\0'
    path += b'\0' * (-len(path) % 4)
    c = CAVE
    words = [
        0xe92d4010,                       # +00 push {r4, lr}
        0xe28f0030,                       # +04 add  r0, pc, #0x30   (adr r0, path @ +3c)
        0xe3a0100c,                       # +08 mov  r1, #12         (as the stock loads)
        0xe3a02000,                       # +0c mov  r2, #0
        bl(c + 0x10, PLT_CREATE_FROM_FILE),  # +10 bl PGFont::createFromFile
        0xe3500000,                       # +14 cmp  r0, #0
        0x0a000005,                       # +18 beq  +34 (no font: nothing changes)
        0xe5c09034,                       # +1c strb r9, [r0, #52]   (the flag init sets)
        0xe5971000,                       # +20 ldr  r1, [r7]        (count)
        0xe0872101,                       # +24 add  r2, r7, r1, lsl #2
        0xe5820004,                       # +28 str  r0, [r2, #4]    (fonts[count])
        0xe2811001,                       # +2c add  r1, r1, #1
        0xe5871000,                       # +30 str  r1, [r7]        (count++)
        0xe8bd4010,                       # +34 pop  {r4, lr}
        b(c + 0x38, PLT_CONTEXT_CREATE),  # +38 b PGContext::create (the displaced call)
    ]
    code = b''.join(struct.pack('<I', w) for w in words)
    assert len(code) == 0x3c
    return code + path


def patch(data, font=FONT):
    if hashlib.md5(data).hexdigest() != INPUT_MD5:
        raise ValueError('libWebKitLuna.so is not the expected input (md5 %s)' % hashlib.md5(data).hexdigest())
    word = lambda a: struct.unpack_from('<I', data, a)[0]
    for a, w in EXPECT.items():
        if word(a) != w:
            raise ValueError('unexpected code at 0x%x: %08x' % (a, word(a)))
    if word(CALL_AT) != bl(CALL_AT, PLT_CONTEXT_CREATE):
        raise ValueError('0x%x is not bl PGContext::create@plt' % CALL_AT)
    code = cave_code(font)
    if any(data[CAVE:CAVE + len(code)]) or CAVE + len(code) > CAVE_END:
        raise ValueError('cave is not free')
    # ELF32 LE: the first PT_LOAD (R+X) ends exactly at the cave; grow it over the cave
    e_phoff, = struct.unpack_from('<I', data, 0x1c)
    e_phentsize, e_phnum = struct.unpack_from('<HH', data, 0x2a)
    out = bytearray(data)
    for i in range(e_phnum):
        ph = e_phoff + i * e_phentsize
        p_type, p_offset, p_vaddr, _, p_filesz, p_memsz, p_flags, _ = struct.unpack_from('<8I', data, ph)
        if p_type == 1 and p_offset == 0:
            if p_vaddr != 0 or p_filesz != CAVE or p_memsz != CAVE or not p_flags & 1:
                raise ValueError('first PT_LOAD is not R+X ending at the cave')
            grown = CAVE + len(code)
            struct.pack_into('<II', out, ph + 16, grown, grown)
            break
    else:
        raise ValueError('no PT_LOAD at offset 0')
    out[CAVE:CAVE + len(code)] = code
    struct.pack_into('<I', out, CALL_AT, bl(CALL_AT, CAVE))
    return bytes(out)


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    font = sys.argv[3] if len(sys.argv) > 3 else FONT
    data = patch(open(src, 'rb').read(), font)
    open(dst, 'wb').write(data)
    print('%s: fifth fallback font %s (md5 %s)' % (dst, font, hashlib.md5(data).hexdigest()))
