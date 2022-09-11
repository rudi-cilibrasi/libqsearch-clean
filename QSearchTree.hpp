#ifndef __QSEARCHTREE_HPP
#define __QSEARCHTREE_HPP

#include <vector>
#include "SimpleMatrix.hpp"
#include "QSearchNeighborList.hpp"

#define CHUNKSIZE 1

#define NODE_FLAG_FRINGE       0x01
#define NODE_FLAG_DONE         0x02
#define NODE_FLAG_NEXTFRINGE   0x04
#define NODE_FLAG_QUARTETINT   0x08
#define NODE_FLAG_ISWALKED     0x10
#define NODE_FLAG_ISFLIPPED    0x20

struct MutationStatistics {
  int total_complex_mutations;
  int total_simple_mutations;
  int total_successful_mutations;
  int last_simple_mutations;
  int total_clonings;
  int total_order_simple_mutations;
  int total_order_complex_mutations;
  int last_order_simple_mutations;
};

typedef enum {
  NODE_TYPE_LEAF,
  NODE_TYPE_KERNEL,
  NODE_TYPE_ALL
} node_type;

typedef std::vector< unsigned int > NodeList;

struct QSearchTree {
  int total_node_count;
  bool must_recalculate_paths;
  bool dist_calculated;
  bool f_score_good;
  double dist_min;
  double dist_max;
  MutationStatistics ms;
  double score;
  std::vector< QSearchNeighborList > n;   
  NodeList p1, p2;
  QMatrix<unsigned int > spm; // Do we need to be copying this around?
  std::vector< unsigned int > nodeflags;
  NodeList leaf_placement;
  // distance matrix
  QMatrix<double>& dm; // Using reference here as we don't want to be copying this big matrix a lot

  // QSearchTree(); // should default constructor exist?
  QSearchTree(QMatrix<double>& dm_init);    // is how_many_leaves needed in C++?
  QSearchTree(const QSearchTree& q);   
  // copy constructor replaces clone()
  QSearchTree(QSearchTree& q, int howManyTries); // replaces qsearch_tree_find_better_tree()
  // qsearch_tree_free() would become ~QSearchTree()
  // however implicit destructor is all that is needed as C++ objects clean their own memory
  //~QSearchTree();

  //    std::string to_s(); // deprecated - not called 

  // function declared but not implemented in C - deprecated
  // bool is_leaf_node(const int& whichNode);
  void calc_min_max();
  unsigned int get_node_count();
  unsigned int get_leaf_node_count();
  unsigned int get_kernel_node_count();
  QMatrix<unsigned int> get_adjacency_matrix();
  bool is_connected(const unsigned int& a, const unsigned int& b);
  bool is_standard_tree();
  unsigned int get_neighbor_count(const unsigned int& a);
  void connect(const unsigned int& a, const unsigned int& b);
  void disconnect(const unsigned int& a, const unsigned int& b);
  void find_path(NodeList& result, unsigned int a, unsigned int b);
  void find_path_fast(NodeList& result, unsigned int a, unsigned int b);
  unsigned int find_path_length(unsigned int& a, unsigned int& b);
  void freshen_spm();
  bool is_consistent_quartet(unsigned int& a, unsigned int& b, unsigned int& c, unsigned int& d);
  unsigned int get_random_node(const node_type& what_kind);
  unsigned int get_random_node_but_not(const node_type& what_kind, const unsigned int& but_not);
  unsigned int get_random_neighbor(const unsigned int& who);
  // obsolete?
    void get_neighbors(NodeList& neighbors, const unsigned int& who); // changed to call by reference
  bool is_valid_tree();
  void complex_mutation();
  int get_mutation_distribution_sample();
  void simple_mutation();
  void simple_mutation_leaf_swap();
  void simple_mutation_subtree_transfer();
  void simple_mutation_subtree_interchange();
  bool can_subtree_transfer();
  bool can_subtree_interchange();
  // changed to call by reference - use iterator?
  void walk_tree(NodeList& result, const unsigned int& fromwhere, bool f_bfs);  
  void walk_tree_bfs(NodeList& result, const unsigned int& fromwhere);
  void walk_tree_dfs(NodeList& result, const unsigned int& fromwhere);
  double calculate_order_cost();
  unsigned int get_column_number(const unsigned int& nodenum);
  // unsigned int get_node_number(const int& columnnum); // deprecated - not called
  void mutate_order_simple();
  void mutate_order_complex();
  void flipped_node_order(NodeList& nodes);  // changed to call by reference
  void walk_filtered(NodeList& nodes, const int& fromwhere, const int& filterType);
  bool is_tree_ternary(); // Returns true if every node has exactly 1 or 3 neighbors
  // Sets the "connectedness" state (TRUE or FALSE) between nodes a and b and
  // returns the old connectedness status that was overwritten.
  bool set_connected(const unsigned int& a, const unsigned int& b, bool newconstate);
  void clear_all_connections();
  double score_tree();
  // double score_tree_fast(); - deprecated - not called
  double score_tree_fast_v2();

  // deferred. Is dm needed? Could this be constructor?
    double read_from_dot(std::string treedot, QMatrix<unsigned int>& dm);  
  // from QLabeledTree - deferred
    std::string to_dot();
    std::string to_nexus();
    std::string to_nexus_full(QMatrix< unsigned int >& dm); // could be an overload of to_nexus()

};

#endif // __QSEARCHTREE_HPP