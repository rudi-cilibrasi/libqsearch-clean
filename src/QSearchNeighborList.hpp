#ifndef __QSEARCH_NEIGHBOR_LIST_HPP
#define __QSEARCH_NEIGHBOR_LIST_HPP

#include <vector>

struct QSearchNeighborList {
    std::vector< unsigned int > n; // list of unsigned int neighbors

    QSearchNeighborList();
    QSearchNeighborList( const QSearchNeighborList& q ); // replaces qsearch_neighborlist_clone()
    ~QSearchNeighborList();

    void add_neighbor(unsigned int w);
    void remove_neighbor(unsigned int w);
    bool has_neighbor(unsigned int w);
    int find_index(unsigned int w);
    void copy_from(const QSearchNeighborList& s);
};

// may be able to use std::vector functions to replace this
void qsearch_copy_intarray(std::vector< unsigned int >& d, const std::vector< unsigned int >& s);

#endif // __QSEARCH_NEIGHBOR_LIST_HPP