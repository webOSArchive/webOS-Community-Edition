// SkDict.h - read-only view of a .skd correction dictionary (see tools/build-skd.py for the
// format). The file is mmap'd, so the pages are shared and only the parts a search touches are
// ever read in.
#ifndef SK_DICT_H
#define SK_DICT_H

#include <string>
#include "SkUtf8.h"

namespace Sk {

struct Node {
    unsigned int firstChild;
    unsigned short cp;
    unsigned short childCount;
    unsigned char freq;   // 0 = not a word end, else AOSP f + 1
    unsigned char flags;
    unsigned short pad;
};

enum {
    FLAG_OFFENSIVE = 1,
    FLAG_NEVER = 2,      // a word, but never suggested (f=0, not_a_word, shortcut source)
    FLAG_CASED = 4,      // real spelling in the cased table
    FLAG_CAPITAL = 8     // real spelling has a capital first letter
};

class Dict {
public:
    Dict();
    ~Dict();
    bool open(const std::string& path);
    void close();
    bool isOpen() const { return m_nodes != 0; }

    const Node& node(unsigned int i) const { return m_nodes[i]; }
    unsigned int nodeCount() const { return m_nodeCount; }

    // Node index of the lowercased word, or 0 if it isn't in the trie (0 is the root).
    unsigned int find(const U32& lowerWord) const;
    // The child of n with codepoint c, or 0.
    unsigned int child(unsigned int n, cp_t c) const;

    // The word at node n as it should be written (lowerWord is its trie key).
    std::string spelling(unsigned int n, const U32& lowerWord) const;
    // The whitelist shortcut at node n ("im" -> "I'm"), or "".
    std::string shortcut(unsigned int n) const;

private:
    const char* lookup(unsigned int n, unsigned int count, unsigned int offset) const;

    void* m_map;
    size_t m_size;
    const Node* m_nodes;
    unsigned int m_nodeCount;
    unsigned int m_casedCount, m_casedOffset;
    unsigned int m_shortCount, m_shortOffset;
    unsigned int m_stringsOffset;
};

}  // namespace Sk

#endif
