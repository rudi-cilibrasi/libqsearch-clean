#ifndef __QSEARCH_NEIGHBOR_LIST_HPP
#define __QSEARCH_NEIGHBOR_LIST_HPP

#include <vector>

class QSearchNeighborList {
    std::vector< unsigned int > n; // list of unsigned int neighbors

    public:

    QSearchNeighborList() {}
    QSearchNeighborList(const QSearchNeighborList& q ) : n(q.n) {}

    // read but not write access via square bracket operator
    unsigned int operator [](const unsigned int& i) const;

    int size() const;
    void clear();
    void add_neighbor(const unsigned int& w);
    void remove_neighbor(const unsigned int& w);
    bool has_neighbor(const unsigned int& w);
    int find_index(const unsigned int& w);
};

#endif // __QSEARCH_NEIGHBOR_LIST_HPP