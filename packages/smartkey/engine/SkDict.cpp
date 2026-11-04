// SkDict.cpp - see SkDict.h
#include "SkDict.h"

#include <fcntl.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>

namespace Sk {

Dict::Dict()
    : m_map(0), m_size(0), m_nodes(0), m_nodeCount(0), m_casedCount(0), m_casedOffset(0),
      m_shortCount(0), m_shortOffset(0), m_stringsOffset(0)
{
}

Dict::~Dict() { close(); }

void Dict::close()
{
    if (m_map) munmap(m_map, m_size);
    m_map = 0;
    m_nodes = 0;
    m_nodeCount = 0;
}

bool Dict::open(const std::string& path)
{
    close();
    int fd = ::open(path.c_str(), O_RDONLY);
    if (fd < 0) return false;
    struct stat st;
    if (fstat(fd, &st) != 0 || st.st_size < 32) { ::close(fd); return false; }
    void* p = mmap(0, st.st_size, PROT_READ, MAP_SHARED, fd, 0);
    ::close(fd);
    if (p == MAP_FAILED) return false;
    const unsigned int* h = (const unsigned int*)p;
    if (memcmp(p, "SKD1", 4) != 0) { munmap(p, st.st_size); return false; }
    unsigned int nodeCount = h[1], nodesOffset = h[2];
    if ((size_t)nodesOffset + (size_t)nodeCount * sizeof(Node) > (size_t)st.st_size ||
        h[7] > (size_t)st.st_size) {
        munmap(p, st.st_size);
        return false;
    }
    m_map = p;
    m_size = st.st_size;
    m_nodeCount = nodeCount;
    m_nodes = (const Node*)((const char*)p + nodesOffset);
    m_casedCount = h[3];
    m_casedOffset = h[4];
    m_shortCount = h[5];
    m_shortOffset = h[6];
    m_stringsOffset = h[7];
    return true;
}

unsigned int Dict::child(unsigned int n, cp_t c) const
{
    const Node& nd = m_nodes[n];
    unsigned int lo = nd.firstChild, hi = nd.firstChild + nd.childCount;
    while (lo < hi) {
        unsigned int mid = (lo + hi) / 2;
        if (m_nodes[mid].cp < c) lo = mid + 1;
        else hi = mid;
    }
    if (nd.childCount && lo < nd.firstChild + nd.childCount && m_nodes[lo].cp == c) return lo;
    return 0;
}

unsigned int Dict::find(const U32& w) const
{
    if (!m_nodes || w.empty()) return 0;
    unsigned int n = 0;
    for (size_t i = 0; i < w.size(); ++i) {
        n = child(n, w[i] > 0xFFFF ? 0xFFFD : w[i]);
        if (!n) return 0;
    }
    return m_nodes[n].freq ? n : 0;
}

const char* Dict::lookup(unsigned int n, unsigned int count, unsigned int offset) const
{
    const unsigned int* t = (const unsigned int*)((const char*)m_map + offset);
    unsigned int lo = 0, hi = count;
    while (lo < hi) {
        unsigned int mid = (lo + hi) / 2;
        if (t[mid * 2] < n) lo = mid + 1;
        else hi = mid;
    }
    if (lo < count && t[lo * 2] == n) return (const char*)m_map + m_stringsOffset + t[lo * 2 + 1];
    return 0;
}

std::string Dict::spelling(unsigned int n, const U32& w) const
{
    const Node& nd = m_nodes[n];
    if (nd.flags & FLAG_CASED) {
        const char* s = lookup(n, m_casedCount, m_casedOffset);
        if (s) return s;
    }
    if ((nd.flags & FLAG_CAPITAL) && !w.empty()) {
        U32 u(w);
        u[0] = toUpper(u[0]);
        return encode(u);
    }
    return encode(w);
}

std::string Dict::shortcut(unsigned int n) const
{
    const char* s = lookup(n, m_shortCount, m_shortOffset);
    return s ? s : "";
}

}  // namespace Sk
