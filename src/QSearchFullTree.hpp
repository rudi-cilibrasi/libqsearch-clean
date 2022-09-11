#ifndef __QSEARCH_FULLTREE_HPP
#define __QSEARCH_FULLTREE_HPP

#include "QSearchTree.hpp"

// All data is statically allocated, so there's no need to resize things

struct FullNode {
    int connections[3];
    
    // cached counts and distance sums
    int         leaf_count[3];
    double      dist[3];

    std::vector<unsigned char> node_branch; // pointing in the direction where to find a node
};

typedef std::vector< FullNode > FullNodeList;

// roll into QSearchTree?
struct QSearchFullTree {
    unsigned int node_count;
    double       raw_score;
    FullNodeList map;
    QMatrix<double>& dm;

    QSearchFullTree(const QSearchTree& clt); // was qsearch_make_fulltree()
    ~QSearchFullTree(); // was void qsearch_free_fulltree()

    static void random_pair(unsigned int& A, unsigned int& B);    // from qsearch-tree.c
    void set_score();
    const QSearchTree& to_searchtree();
    unsigned int next_node(const unsigned int& from, const unsigned int& to);
    // bool can_swap(const unsigned int& A, const unsigned int& B); // deprecated - not called
    bool can_swap(const unsigned int& a, const unsigned int& b);
    void swap_nodes(const unsigned int& a, const unsigned int& b);
    unsigned int move_to(unsigned int from, unsigned int to);
    unsigned int find_sibling(unsigned int node, unsigned int ancestor);
    double  sum_distance(int a, int b);
    double  sum_distance_org(const unsigned int& a, const unsigned int& b);
    // get children in the context of an ancestor 
    void    get_children(const unsigned int&  node, const unsigned int& ancestor, unsigned int& child1, unsigned int& child2);  
};

#endif // __QSEARCH_FULLTREE_HPP
