// SkCorrector.cpp - see SkCorrector.h
#include "SkCorrector.h"

#include <algorithm>

namespace Sk {

Params::Params()
    : subNear(0.6f), subFar(1.0f), subAccent(0.15f), firstLetter(0.3f),
      insNear(0.55f), insFar(0.9f), insApostrophe(0.3f),
      delDouble(0.5f), delFar(0.9f), delApostrophe(0.15f),
      transpose(0.6f), acronym(1.0f),
      costWeight(10.0f), maxCost(2.0f),
      autoMaxCost(1.3f), autoMargin(1.5f), capitalMargin(1.5f), autoMinFreq(40)
{
}

namespace {

const int MAX_LEN = 40;

bool byScore(const Candidate& a, const Candidate& b)
{
    if (a.score != b.score) return a.score > b.score;
    return a.word < b.word;
}

float min3(float a, float b, float c) { return std::min(a, std::min(b, c)); }

// BTW, IPS: two or more letters, all capitals
bool isAcronym(const std::string& spelling)
{
    U32 u = decode(spelling);
    size_t letters = 0;
    for (size_t i = 0; i < u.size(); ++i) {
        if (!isLetter(u[i])) continue;
        if (!isUpper(u[i])) return false;
        ++letters;
    }
    return letters > 1;
}

}  // namespace

struct Corrector::Walk {
    U32 in;                  // typed word, lowercased
    int n;
    float maxCost;
    std::vector<float> rows; // (MAX_LEN + 2) x (n + 1)
    cp_t wch[MAX_LEN + 2];   // the word's characters along the current path (1-based)
    std::vector<float> insCost; // cost of the typed character j being an extra tap
    std::vector<Candidate> out;
    std::vector<unsigned int> outNode;
    float* row(int d) { return &rows[d * (n + 1)]; }
};

Corrector::Corrector() {}

bool Corrector::load(const std::string& path) { return m_dict.open(path); }

bool Corrector::inDictionary(const std::string& word) const
{
    unsigned int n = m_dict.find(lower(decode(word)));
    return n && !(m_dict.node(n).flags & FLAG_NEVER);
}

std::string Corrector::applyCase(const U32& typed, const std::string& spelling) const
{
    size_t letters = 0, upper = 0;
    for (size_t i = 0; i < typed.size(); ++i)
        if (isLetter(typed[i])) { ++letters; if (isUpper(typed[i])) ++upper; }
    U32 s = decode(spelling);
    if (letters > 1 && upper == letters) {
        for (size_t i = 0; i < s.size(); ++i) s[i] = toUpper(s[i]);
    } else if (!typed.empty() && isUpper(typed[0]) && !s.empty()) {
        s[0] = toUpper(s[0]);
    }
    return encode(s);
}

void Corrector::walk(Walk& w, unsigned int node, int d) const
{
    const Node& nd = m_dict.node(node);
    const int n = w.n;
    const Params& p = m_p;
    for (unsigned int ci = nd.firstChild; ci < nd.firstChild + nd.childCount; ++ci) {
        const Node& ch = m_dict.node(ci);
        const cp_t c = ch.cp;
        const int dd = d + 1;
        w.wch[dd] = c;
        float* prev = w.row(d);
        float* cur = w.row(dd);
        float* pp = d > 0 ? w.row(d - 1) : 0;

        // the word has c, the typed word doesn't: a missed tap
        float del = isApostrophe(c) ? p.delApostrophe
                  : (d > 0 && w.wch[d] == c) ? p.delDouble : p.delFar;
        cur[0] = prev[0] + del;
        float rowMin = cur[0];
        for (int j = 1; j <= n; ++j) {
            const cp_t s = w.in[j - 1];
            float sub;
            if (s == c) sub = 0.0f;
            else if (baseLetter(s) == baseLetter(c)) sub = p.subAccent;
            else {
                sub = m_kb.adjacent(s, c) ? p.subNear : p.subFar;
                if (j == 1 && dd == 1) sub += p.firstLetter;
            }
            float v = min3(prev[j - 1] + sub, prev[j] + del, cur[j - 1] + w.insCost[j]);
            if (pp && j > 1 && s == w.wch[d] && w.in[j - 2] == c && s != c)
                v = std::min(v, pp[j - 2] + p.transpose);
            cur[j] = v;
            if (v < rowMin) rowMin = v;
        }
        if (ch.freq && !(ch.flags & FLAG_NEVER) && cur[n] <= w.maxCost) {
            Candidate cd;
            cd.cost = cur[n];
            cd.freq = ch.freq - 1;
            cd.offensive = (ch.flags & FLAG_OFFENSIVE) != 0;
            cd.score = cd.freq / 16.0f - cd.cost * p.costWeight;
            w.out.push_back(cd);
            w.outNode.push_back(ci);
            U32 word(w.wch + 1, w.wch + dd + 1);
            w.out.back().word = encode(word);
        }
        if (rowMin <= w.maxCost && dd < MAX_LEN) walk(w, ci, dd);
    }
}

Correction Corrector::correct(const std::string& typedUtf8, int maxGuesses, KnownFn isKnown,
                              void* ctx) const
{
    Correction r;
    U32 typed = decode(typedUtf8);
    if (!m_dict.isOpen() || typed.empty()) { r.valid = true; return r; }

    // Leave alone anything that isn't a plain word: numbers, mixed symbols, one letter typed
    // as a capital (a deliberate "A"), all-caps acronyms.
    size_t letters = 0, upper = 0;
    for (size_t i = 0; i < typed.size(); ++i) {
        cp_t c = typed[i];
        if (isLetter(c)) { ++letters; if (isUpper(c)) ++upper; }
        else if (!isApostrophe(c) && c != '-') { r.valid = true; return r; }
    }
    // a capital after the first letter (webOS, iPad, McDonald) is deliberate
    bool innerCapital = false;
    for (size_t i = 1; i < typed.size(); ++i)
        if (isUpper(typed[i])) innerCapital = true;
    if (letters == 0 || (int)typed.size() > MAX_LEN - 2 || (letters > 1 && upper == letters) ||
        (letters == 1 && upper == 1) || innerCapital) {
        r.valid = true;
        return r;
    }
    U32 low = lower(typed);
    for (size_t i = 0; i < low.size(); ++i)
        if (low[i] == 0x2019) low[i] = '\'';

    unsigned int exact = m_dict.find(low);
    if (exact) {
        std::string sc = m_dict.shortcut(exact);
        if (!sc.empty()) {                               // im -> I'm, ill -> I'll
            Candidate cd;
            cd.word = upper ? applyCase(typed, sc) : sc;
            cd.cost = 0; cd.score = 0; cd.freq = 255; cd.offensive = false;
            r.guesses.push_back(cd);
            r.autoAccept = r.caseOnly = true;
            return r;
        }
        const Node& nd = m_dict.node(exact);
        if (!(nd.flags & FLAG_NEVER)) {
            r.valid = true;
            std::string sp = m_dict.spelling(exact, low);
            if (upper == 0 && sp != encode(low) && !isAcronym(sp)) {  // i -> I, monday -> Monday
                Candidate cd;
                cd.word = sp;
                cd.cost = 0; cd.score = 0; cd.freq = nd.freq - 1; cd.offensive = false;
                r.guesses.push_back(cd);
                r.valid = false;
                r.autoAccept = r.caseOnly = true;
            }
            return r;
        }
    }
    if (isKnown && isKnown(typedUtf8, ctx)) { r.valid = true; return r; }

    Walk w;
    w.in = low;
    w.n = (int)low.size();
    w.maxCost = w.n <= 3 ? 1.0f : w.n <= 5 ? 1.6f : m_p.maxCost;
    w.rows.assign((MAX_LEN + 2) * (w.n + 1), 0.0f);
    w.insCost.assign(w.n + 1, 0.0f);
    for (int j = 1; j <= w.n; ++j) {
        cp_t s = low[j - 1];
        bool near = (j > 1 && (low[j - 2] == s || m_kb.adjacent(low[j - 2], s))) ||
                    (j < w.n && (low[j] == s || m_kb.adjacent(low[j], s)));
        w.insCost[j] = isApostrophe(s) ? m_p.insApostrophe : near ? m_p.insNear : m_p.insFar;
    }
    float* r0 = w.row(0);
    r0[0] = 0.0f;
    for (int j = 1; j <= w.n; ++j) r0[j] = r0[j - 1] + w.insCost[j];
    w.wch[0] = 0;
    walk(w, 0, 0);

    for (size_t i = 0; i < w.out.size(); ++i) {
        unsigned int node = w.outNode[i];
        U32 key = decode(w.out[i].word);
        std::string sp = m_dict.spelling(node, key);
        if (isAcronym(sp)) {                 // all-caps typing returned above
            w.out[i].cost += m_p.acronym;
            w.out[i].score -= m_p.acronym * m_p.costWeight;
        }
        w.out[i].word = applyCase(typed, sp);
    }
    std::sort(w.out.begin(), w.out.end(), byScore);
    // drop offensive words unless nothing else is close
    std::vector<Candidate> kept;
    int keep = std::max(maxGuesses, 2);
    for (size_t i = 0; i < w.out.size() && (int)kept.size() < keep; ++i)
        if (!w.out[i].offensive) kept.push_back(w.out[i]);
    r.guesses = kept;

    if (!r.guesses.empty() && letters >= 2) {
        const Candidate& b = r.guesses[0];
        float margin = m_p.autoMargin + (isUpper(typed[0]) ? m_p.capitalMargin : 0.0f);
        bool clear = r.guesses.size() < 2 || b.score - r.guesses[1].score >= margin;
        r.autoAccept = b.cost <= m_p.autoMaxCost && b.freq >= m_p.autoMinFreq && clear;
    }
    if ((int)r.guesses.size() > maxGuesses) r.guesses.resize(std::max(maxGuesses, 0));
    if (r.guesses.empty()) r.autoAccept = false;
    return r;
}

}  // namespace Sk
