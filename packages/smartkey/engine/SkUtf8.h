// SkUtf8.h - UTF-8 <-> UTF-32 and the small amount of case/accent folding the corrector needs.
// No ICU: the folding covers Latin-1, Latin Extended-A, Greek and basic Cyrillic, which is every
// language webOS ships a keyboard for. C++98 (the device toolchain is gcc 4.3.3).
#ifndef SK_UTF8_H
#define SK_UTF8_H

#include <string>
#include <vector>

namespace Sk {

typedef unsigned int cp_t;
typedef std::vector<cp_t> U32;

U32 decode(const std::string& s);
std::string encode(const U32& u);
std::string encode(cp_t c);

cp_t toLower(cp_t c);
cp_t toUpper(cp_t c);
// The unaccented base letter (e -> e, é -> e, ß -> s, ø -> o); c itself if it has none.
cp_t baseLetter(cp_t c);

bool isUpper(cp_t c);
bool isLetter(cp_t c);
bool isApostrophe(cp_t c);  // ' and U+2019

U32 lower(const U32& u);

}  // namespace Sk

#endif
