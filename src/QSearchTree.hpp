#ifndef __QSEARCHTREE_HPP
#define __QSEARCHTREE_HPP

#include <vector>

template< class T> class SimpleMatrix;
struct LabeledMatrix {};
typedef int foo;

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

//typedef std::unique_ptr< QSearchNeighborList > nptr;

struct QSearchTree {
  int total_node_count;
  bool must_recalculate_paths;
  bool dist_calculated;
  bool f_score_good;
  double dist_min;
  double dist_max;
  MutationStatistics ms;
  double score;
  std::vector< std::unique_ptr< QSearchNeighborList > > n;   // could also use std::unique_ptr
  std::vector< unsigned int > p1, p2;
  std::vector< std::unique_ptr< std::vector< unsigned int > > > spm;
  std::vector< std::unique_ptr< foo > > nodeflags;
  std::vector< unsigned int > leaf_placement;

  // QSearchTree(); // should default constructor exist?
  QSearchTree(int how_many_leaves);    // is how_many_leaves needed in C++?
  QSearchTree(QSearchTree& q);  // copy constructor replaces clone()
  QSearchTree(QSearchTree& q, int howManyTries, const SimpleMatrix<unsigned int>& dm); // replaces qsearch_tree_find_better_tree()
  // qsearch_tree_free() would become ~QSearchTree()
  // however implicit destructor is all that is needed as C++ objects clean their own memory
  //~QSearchTree();

  // function declared but not implemented in C - deprecated
  // bool is_leaf_node(const int& whichNode);
  void calc_min_max(const SimpleMatrix<unsigned int>& dm);
  unsigned int get_node_count();
  unsigned int get_leaf_node_count();
  unsigned int get_kernel_node_count();
  SimpleMatrix<unsigned int>& get_adjacency_matrix();
  bool is_connected(const unsigned int& a, const unsigned int& b);
  bool is_standard_tree();
  int get_neighbor_count(const int& a);
  void connect(const int& a, const int& b);
  void disconnect(const int& a, const int& b);
  std::vector<foo>& find_path(const int& a, const int& b);
  bool is_consistent_quartet(const int& a, const int& b, const int& c, const int& d);
  double score_tree(const SimpleMatrix<unsigned int>& dm);
  int get_random_node(const int& what_kind);
  int get_random_node_but_not(const int& what_kind, const int& but_not);
  int find_path_length(const int& a, const int& b);
  int get_random_neighbor(const int& who);
  std::vector<foo>& get_neighbors(const int& who);
  bool is_valid_tree();
  void complex_mutation();
  void simple_mutation();
  void simple_mutation_leaf_swap();
  void simple_mutation_subtree_transfer();
  void simple_mutation_subtree_interchange();
  void simple_mutation();
  bool can_subtree_transfer();
  bool can_subtree_interchange();
  std::vector<foo>& walk_tree(const int& fromwhere, bool f_bfs);
  std::vector<foo>& walk_tree_bfs(const int& fromwhere);
  std::vector<foo>& walk_tree_dfs(const int& fromwhere);
  double calculate_order_cost(const SimpleMatrix<unsigned int> *dm);
  int get_column_number(const int& nodenum);
  int get_node_number(const int& columnnum);
  void mutate_order_simple();
  void mutate_order_complex();
  std::string to_s();
  std::vector<foo>& flipped_node_order();
  std::vector<foo>& walk_filtered(const int& fromwhere, const int& filterType);

  /* Returns true if every node has exactly 1 or 3 neighbors */
  bool is_tree_ternary();

  /* Sets the "connectedness" state (TRUE or FALSE) between nodes a and b and
  * returns the old connectedness status that was overwritten.
  */
  bool set_connected(const int& a, const int& b, bool newconstate);

  void clear_all_connections();
  double read_from_dot(std::string treedot, LabeledMatrix& lm);
};

class QLabeledTree {
  QSearchTree& qs;
  std::vector<std::string> labels;
  SimpleMatrix<unsigned int> mat;

  QLabeledTree(const QSearchTree& tree, const LabeledMatrix& lm); // replaces qsearch_tree_add_labels()
  ~QLabeledTree(); 

  std::string to_dot();
  std::string to_nexus();
  std::string to_nexus_full(LabeledMatrix& lm); // could be an overload of to_nexus()
};

#endif // __QSEARCHTREE_HPP