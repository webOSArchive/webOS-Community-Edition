// skcli - run the corrector (and smartkey-hun's Hunspell-first behaviour, as the baseline) over
// typed words, one per line on stdin. Host-side, for tools/eval.py; not shipped.
//
//   skcli <dict.skd> <hunspell.aff> <hunspell.dic> [layout] [param=value ...]
//
// Output, tab-separated, one line per input:
//   typed  new_valid  new_auto  new_top  new_guesses(|)  hun_valid  hun_top
// new_top / hun_top are what the word would become after a space: the auto-accepted guess, or
// the typed word unchanged. smartkey-hun auto-accepts Hunspell's first suggestion whenever the
// word isn't spelled correctly (SmkyHunspellDatabase::findGuesses).
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>

#include <hunspell.hxx>

#include "SkCorrector.h"

static Hunspell* g_hun = 0;

static bool hunKnown(const std::string& w, void*)
{
    return g_hun->spell(w.c_str()) != 0;
}

int main(int argc, char** argv)
{
    if (argc < 4) {
        fprintf(stderr, "usage: skcli dict.skd hun.aff hun.dic [layout] [param=value ...]\n");
        return 2;
    }
    Sk::Corrector c;
    if (!c.load(argv[1])) { fprintf(stderr, "can't load %s\n", argv[1]); return 1; }
    g_hun = new Hunspell(argv[2], argv[3]);
    bool baseline = true;
    for (int i = 4; i < argc; ++i) {
        const char* a = argv[i];
        const char* eq = strchr(a, '=');
        if (!eq) { c.setLayout(a); continue; }
        std::string k(a, eq - a);
        float v = (float)atof(eq + 1);
        Sk::Params& p = c.params();
        if (k == "subNear") p.subNear = v;
        else if (k == "subFar") p.subFar = v;
        else if (k == "subAccent") p.subAccent = v;
        else if (k == "firstLetter") p.firstLetter = v;
        else if (k == "insNear") p.insNear = v;
        else if (k == "insFar") p.insFar = v;
        else if (k == "delDouble") p.delDouble = v;
        else if (k == "delFar") p.delFar = v;
        else if (k == "transpose") p.transpose = v;
        else if (k == "acronym") p.acronym = v;
        else if (k == "costWeight") p.costWeight = v;
        else if (k == "maxCost") p.maxCost = v;
        else if (k == "autoMaxCost") p.autoMaxCost = v;
        else if (k == "autoMargin") p.autoMargin = v;
        else if (k == "capitalMargin") p.capitalMargin = v;
        else if (k == "autoMinFreq") p.autoMinFreq = (int)v;
        else if (k == "baseline") baseline = v != 0;
        else { fprintf(stderr, "unknown param %s\n", k.c_str()); return 2; }
    }
    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;
        Sk::Correction r = c.correct(line, 5, hunKnown, 0);
        std::string top = (r.autoAccept && !r.guesses.empty()) ? r.guesses[0].word : line;
        std::string gs;
        for (size_t i = 0; i < r.guesses.size(); ++i) {
            if (i) gs += "|";
            gs += r.guesses[i].word;
        }
        std::string hv = "-", ht = "-";
        if (baseline) {
            bool ok = g_hun->spell(line.c_str()) != 0;
            hv = ok ? "1" : "0";
            ht = line;
            if (!ok) {
                char** sl = 0;
                int n = g_hun->suggest(&sl, line.c_str());
                if (n > 0) ht = sl[0];
                g_hun->free_list(&sl, n);
            }
        }
        std::cout << line << '\t' << (r.valid ? 1 : 0) << '\t' << (r.autoAccept ? 1 : 0) << '\t'
                  << top << '\t' << gs << '\t' << hv << '\t' << ht << '\n';
    }
    return 0;
}
