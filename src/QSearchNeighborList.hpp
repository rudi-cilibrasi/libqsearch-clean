#ifndef __QSEARCH_NEIGHBOR_LIST_HPP
#define __QSEARCH_NEIGHBOR_LIST_HPP

#include <vector>
#include "QSearchTree.hpp"

struct QSearchNeighborList {
    NodeList n; // list of unsigned int neighbors

    QSearchNeighborList() {}
    QSearchNeighborList(const QSearchNeighborList& q ); // replaces qsearch_neighborlist_clone()

    void add_neighbor(const unsigned int& w);
    void remove_neighbor(const unsigned int& w);
    bool has_neighbor(const unsigned int& w);
    int find_index(const unsigned int& w);
};

#endif // __QSEARCH_NEIGHBOR_LIST_HPP