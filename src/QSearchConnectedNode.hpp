#include <vector>
#include "QSearchTree.hpp"

struct QSearchConnectedNode {
    int done;
    int connections[3];
    int leaf_count[3];
    std::vector< char > node_branch; // pointing in the direction where to find a node (?)

    int find_branch(const int& to);

    QSearchConnectedNode( const unsigned int& branches );
};

struct QSearchConnectedNodeMap {
    std::vector<QSearchConnectedNode> map;

    QSearchConnectedNodeMap( const QSearchTree& clt ); // replaces init_node_map()

    QSearchConnectedNode  operator [](const unsigned int& i) const; 
    QSearchConnectedNode& operator [](const unsigned int& i); 

    unsigned int next_node(const unsigned int& from, const unsigned int& to);
};


