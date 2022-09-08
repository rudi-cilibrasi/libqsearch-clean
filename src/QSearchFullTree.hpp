#ifndef __QSEARCH_FULLTREE_HPP
#define __QSEARCH_FULLTREE_HPP

#include "QSearchTree.hpp"

// roll into QSearchTree?
struct QSearchFullTree {
    void*        data; // ?
    unsigned int node_count;
    double       raw_score;

    QSearchFullTree(QSearchTree& clt, QMatrix<double>& dm); // was qsearch_make_fulltree()
    ~QSearchFullTree(); // was void qsearch_free_fulltree()

    static void random_pair(unsigned int& A, unsigned int& B);    // from qsearch-tree.c

    void to_searchtree(QSearchTree& dest);

    // bool can_swap(const unsigned int& A, const unsigned int& B); // deprecated - not called
    void swap_nodes(const unsigned int& A, const unsigned int&, const QMatrix<double>& dm);
    void swap_nodes(const unsigned int& A, const unsigned int& B);
                    
    unsigned int move_to(unsigned int from, unsigned int to);
    unsigned int find_sibling(unsigned int node, unsigned int ancestor);
    double  sum_distance(int a, int b);

    // get children in the context of an ancestor 
    void    get_children(int node, int ancestor, int& child1, int& child2);
};

#endif // __QSEARCH_FULLTREE_HPP
