// SkUtf8.cpp - see SkUtf8.h
#include "SkUtf8.h"

namespace Sk {

U32 decode(const std::string& s)
{
    U32 out;
    size_t i = 0, n = s.size();
    while (i < n) {
        unsigned char c = (unsigned char)s[i];
        cp_t cp;
        int len;
        if (c < 0x80) { cp = c; len = 1; }
        else if ((c & 0xE0) == 0xC0) { cp = c & 0x1F; len = 2; }
        else if ((c & 0xF0) == 0xE0) { cp = c & 0x0F; len = 3; }
        else if ((c & 0xF8) == 0xF0) { cp = c & 0x07; len = 4; }
        else { out.push_back(0xFFFD); ++i; continue; }
        if (i + len > n) { out.push_back(0xFFFD); break; }
        bool ok = true;
        for (int k = 1; k < len; ++k) {
            unsigned char cc = (unsigned char)s[i + k];
            if ((cc & 0xC0) != 0x80) { ok = false; break; }
            cp = (cp << 6) | (cc & 0x3F);
        }
        if (!ok) { out.push_back(0xFFFD); ++i; continue; }
        out.push_back(cp);
        i += len;
    }
    return out;
}

std::string encode(cp_t c)
{
    std::string s;
    if (c < 0x80) s += (char)c;
    else if (c < 0x800) { s += (char)(0xC0 | (c >> 6)); s += (char)(0x80 | (c & 0x3F)); }
    else if (c < 0x10000) {
        s += (char)(0xE0 | (c >> 12)); s += (char)(0x80 | ((c >> 6) & 0x3F)); s += (char)(0x80 | (c & 0x3F));
    } else {
        s += (char)(0xF0 | (c >> 18)); s += (char)(0x80 | ((c >> 12) & 0x3F));
        s += (char)(0x80 | ((c >> 6) & 0x3F)); s += (char)(0x80 | (c & 0x3F));
    }
    return s;
}

std::string encode(const U32& u)
{
    std::string s;
    for (size_t i = 0; i < u.size(); ++i) s += encode(u[i]);
    return s;
}

cp_t toLower(cp_t c)
{
    if (c >= 'A' && c <= 'Z') return c + 32;
    if (c < 0xC0) return c;
    if (c <= 0xDE && c != 0xD7) return c + 32;                 // À..Þ except ×
    if (c >= 0x100 && c <= 0x17F) {                              // Latin Extended-A pairs
        if (c == 0x130) return 'i';
        if (c == 0x178) return 0xFF;
        if ((c >= 0x139 && c <= 0x148) || (c >= 0x179 && c <= 0x17E)) return (c & 1) ? c + 1 : c;
        if (c == 0x149 || c == 0x138 || c == 0x17F) return c;
        return (c & 1) ? c : c + 1;
    }
    if (c >= 0x391 && c <= 0x3AB && c != 0x3A2) return c + 32;  // Greek
    if (c >= 0x410 && c <= 0x42F) return c + 32;                 // Cyrillic
    if (c >= 0x400 && c <= 0x40F) return c + 80;
    return c;
}

cp_t toUpper(cp_t c)
{
    if (c >= 'a' && c <= 'z') return c - 32;
    if (c < 0xDF) return c;
    if (c >= 0xE0 && c <= 0xFE && c != 0xF7) return c - 32;
    if (c == 0xFF) return 0x178;
    if (c >= 0x100 && c <= 0x17F) {
        if (c == 0x131) return 'I';
        if ((c >= 0x139 && c <= 0x148) || (c >= 0x179 && c <= 0x17E)) return (c & 1) ? c : c - 1;
        if (c == 0x149 || c == 0x138 || c == 0x17F) return c;
        return (c & 1) ? c - 1 : c;
    }
    if (c >= 0x3B1 && c <= 0x3CB && c != 0x3C2) return c - 32;
    if (c >= 0x430 && c <= 0x44F) return c - 32;
    if (c >= 0x450 && c <= 0x45F) return c - 80;
    return c;
}

bool isUpper(cp_t c) { return toLower(c) != c; }

bool isLetter(cp_t c)
{
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) return true;
    if (c >= 0xC0 && c <= 0x24F && c != 0xD7 && c != 0xF7) return true;
    if (c >= 0x370 && c <= 0x52F) return true;
    return false;
}

bool isApostrophe(cp_t c) { return c == '\'' || c == 0x2019; }

cp_t baseLetter(cp_t c)
{
    if (c < 0xC0) return c;
    // Latin-1 lowercase block 0xE0..0xFF
    static const char lat1[] =
        "aaaaaaaceeeeiiii" "dnooooo/ouuuuyty";                       // E0..FF ('/' = ÷)
    cp_t l = toLower(c);
    if (l >= 0xE0 && l <= 0xFF) {
        char b = lat1[l - 0xE0];
        return b == '/' ? c : (cp_t)b;
    }
    if (c == 0xDF) return 's';
    if (l >= 0x100 && l <= 0x17F) {
        static const char extA[] =
            "aaaaaaccccccccdd" "ddeeeeeeeeeegggg"                       // 100..11F
            "gggghhhhiiiiiiii" "iijjjjkkklllllll"                       // 120..13F
            "lllnnnnnnnnnoooo" "oooorrrrrrssssss"                       // 140..15F
            "ssttttttuuuuuuuu" "uuuuwwyyyzzzzzzs";                      // 160..17F
        return (cp_t)extA[l - 0x100];
    }
    return c;
}

U32 lower(const U32& u)
{
    U32 out(u.size());
    for (size_t i = 0; i < u.size(); ++i) out[i] = toLower(u[i]);
    return out;
}

}  // namespace Sk
