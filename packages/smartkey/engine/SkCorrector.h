// SkCorrector.h - auto-correct for one typed word.
//
// Candidates come from a bounded walk of the dictionary trie with a weighted Damerau-Levenshtein
// distance: a slip onto a neighbouring key, a doubled or missed double letter, a missing
// apostrophe or accent cost less than an arbitrary edit. Candidates are ranked by
// word frequency minus edit cost, and the best is auto-accepted only when it clearly beats the
// runner-up. What counts as a real word beyond this dictionary (Hunspell, the user's words) is
// the caller's, through the isKnown callback.
#ifndef SK_CORRECTOR_H
#define SK_CORRECTOR_H

#include <string>
#include <vector>
#include "SkDict.h"
#include "SkKeyboard.h"

namespace Sk {

struct Params {
    float subNear, subFar, subAccent, firstLetter;
    float insNear, insFar, insApostrophe;
    float delDouble, delFar, delApostrophe;
    float transpose;
    float acronym;         // extra cost of offering BTW for a lowercase word
    float costWeight;      // score = freq/16 - cost * costWeight
    float maxCost;         // search bound for words of 6+ letters (shorter words get less)
    float autoMaxCost;     // never auto-accept a candidate costing more than this
    float autoMargin;      // ... or one that doesn't beat the runner-up by this much
    float capitalMargin;   // extra margin when the typed word starts with a capital
    int autoMinFreq;       // ... or one rarer than this (AOSP f)
    Params();
};

struct Candidate {
    std::string word;   // spelled as it should be written (typed case applied)
    float cost;
    float score;
    int freq;           // AOSP f
    bool offensive;
};

struct Correction {
    bool valid;                    // the typed word is a word (no change needed)
    bool autoAccept;               // replace the typed word with guesses[0]
    bool caseOnly;                 // guesses[0] differs only in case (i -> I) or by a shortcut
    std::vector<Candidate> guesses;
    Correction() : valid(false), autoAccept(false), caseOnly(false) {}
};

class Corrector {
public:
    typedef bool (*KnownFn)(const std::string& word, void* ctx);

    Corrector();
    bool load(const std::string& skdPath);
    bool loaded() const { return m_dict.isOpen(); }
    void setLayout(const std::string& layout) { m_kb.setLayout(layout); }
    Params& params() { return m_p; }

    // Is the word in this dictionary (in any case)?
    bool inDictionary(const std::string& word) const;

    Correction correct(const std::string& typed, int maxGuesses, KnownFn isKnown = 0,
                       void* ctx = 0) const;

private:
    struct Walk;
    void walk(Walk& w, unsigned int node, int depth) const;
    std::string applyCase(const U32& typed, const std::string& spelling) const;

    Dict m_dict;
    Keyboard m_kb;
    Params m_p;
};

}  // namespace Sk

#endif
