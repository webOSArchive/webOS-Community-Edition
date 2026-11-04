// SkKeyboard.h - key geometry for the TouchPad keyboard layouts, so the corrector can price a
// slip onto a neighbouring key below an arbitrary substitution.
#ifndef SK_KEYBOARD_H
#define SK_KEYBOARD_H

#include <map>
#include <string>
#include "SkUtf8.h"

namespace Sk {

class Keyboard {
public:
    // layout: "qwerty"/"qwertz"/"azerty" or the device's names (english, german, french);
    // anything else is qwerty.
    explicit Keyboard(const std::string& layout = "qwerty");
    void setLayout(const std::string& layout);

    // Distance between the keys of a and b in key widths (accented letters sit on their base
    // letter's key), or -1 if either isn't on the keyboard.
    float distance(cp_t a, cp_t b) const;
    bool adjacent(cp_t a, cp_t b) const;

private:
    struct Pos { float x, y; };
    std::map<cp_t, Pos> m_keys;
};

}  // namespace Sk

#endif
