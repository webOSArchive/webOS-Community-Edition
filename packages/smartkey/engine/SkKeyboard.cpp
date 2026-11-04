// SkKeyboard.cpp - see SkKeyboard.h
#include "SkKeyboard.h"

#include <math.h>

namespace Sk {

Keyboard::Keyboard(const std::string& layout) { setLayout(layout); }

void Keyboard::setLayout(const std::string& layout)
{
    // Rows as typed on the TouchPad's letter keyboard, with each row's offset in key widths.
    const char* rows[3];
    float off[3] = { 0.0f, 0.25f, 0.75f };
    if (layout == "qwertz") {
        rows[0] = "qwertzuiop\xC3\xBC"; rows[1] = "asdfghjkl\xC3\xB6\xC3\xA4"; rows[2] = "yxcvbnm";
    } else if (layout == "azerty") {
        rows[0] = "azertyuiop"; rows[1] = "qsdfghjklm"; rows[2] = "wxcvbn'";
    } else {
        rows[0] = "qwertyuiop"; rows[1] = "asdfghjkl\xC3\xB1"; rows[2] = "zxcvbnm'";
    }
    m_keys.clear();
    for (int r = 0; r < 3; ++r) {
        U32 u = decode(rows[r]);
        for (size_t i = 0; i < u.size(); ++i) {
            Pos p;
            p.x = off[r] + (float)i;
            p.y = (float)r;
            m_keys[u[i]] = p;
        }
    }
}

float Keyboard::distance(cp_t a, cp_t b) const
{
    a = toLower(a);
    b = toLower(b);
    std::map<cp_t, Pos>::const_iterator ia = m_keys.find(a), ib = m_keys.find(b);
    if (ia == m_keys.end()) ia = m_keys.find(baseLetter(a));
    if (ib == m_keys.end()) ib = m_keys.find(baseLetter(b));
    if (ia == m_keys.end() || ib == m_keys.end()) return -1.0f;
    float dx = ia->second.x - ib->second.x, dy = ia->second.y - ib->second.y;
    return sqrtf(dx * dx + dy * dy);
}

bool Keyboard::adjacent(cp_t a, cp_t b) const
{
    float d = distance(a, b);
    return d > 0.0f && d < 1.3f;
}

}  // namespace Sk
