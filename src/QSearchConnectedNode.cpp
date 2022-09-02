#include "QSearchConnectedNode.hpp"
#include "QSearchNeighborList.hpp"

inline int QSearchConnectedNode::find_branch(const int &to) {
    if (connections[0] == to) return 0;
    if (connections[1] == to) return 1;
    if (connections[2] == to) return 2;
    assert(0); // 
    return -1;
}

QSearchConnectedNodeMap::QSearchConnectedNodeMap(const QSearchTree &clt) {
    const int node_count = clt.total_node_count;
    const int leaf_count = (node_count + 2)/2;
       
    for (int i = 0; i < node_count; ++i) {
        map[i].done = 0;
        for (int j = 0; j < 3; ++j) {
            map[i].connections[j] = -1;
            map[i].leaf_count[j] = 0;
        }
        
        if (i < leaf_count) {
            for (int j=0; j < node_count; ++j) map[i].node_branch[j] = 0;
            map[i].leaf_count[0] = leaf_count - 1;
            map[i].done = 1;
        } else {
            for (int j = 0; j < node_count; ++j) map[i].node_branch[j] = -1;
        } 
    }
     
    // set connections (construct tree)
    //for( auto& cln : clt.n) {
    for (int i = 0; i < node_count; ++i) {
        const QSearchNeighborList& cln = clt.n[i];
        // add to connected nodes
        for( auto& j : cln.n ) {
        //for (j = 0; j < cln.n.len; ++j) {
            //int node = cln.n[j];
        
            // find unfilled branch
            int branch = map[j].find_branch(-1);
            map[j].connections[branch] = i; // set connection
            
            if (i < leaf_count) {
                map[j].leaf_count[branch] = 1; // set leaf
            }
            map[j].node_branch[i] = branch; // leaf can be found in branch

            // set connection back to this node
            branch = map[i].find_branch(-1);
            map[i].connections[branch] = j;
            map[i].node_branch[j] = branch;
        }
    }

    // every iteration, this loop progresses by at least finishing one node. Worst case is n^3 (for 'linear' trees)
    for (;;) {
        for (int i = leaf_count; i < node_count; ++i) {
            
            if (map[i].done) continue; // nothing to be done here
                        
            for (int j = 0; j < 3; ++j) {
                int node = map[i].connections[j];
                if (map[node].done) continue; 

                int branch = map[node].find_branch(i);
                if (map[node].leaf_count[branch] == 0) {
                    int first = (3 + j-1) % 3;
                    int second = (j + 1) % 3;
                    if (map[i].leaf_count[first] != 0 && map[i].leaf_count[second] != 0) {
                        map[node].leaf_count[branch] = map[i].leaf_count[first] + map[i].leaf_count[second];
                        
                        // set the nodes in the other
                        int k;
                        for (k = 0; k < node_count; ++k) {
                            // node present in one of the two branches pointing away from this
                            int node_present = k==i || map[i].node_branch[k] == first || map[i].node_branch[k] == second;
                            
                            if (node_present && map[node].node_branch[k] == -1) map[node].node_branch[k] = branch;
                        }
                    }
                }
            }
        }
        
        int all_done = 1;
        for (int i = leaf_count; i < node_count; ++i) {
            if (map[i].done) continue;
            
            // we are done when all entries are set for this node, AND there are no pending assignments to neighbours

            // are all entries set for this node?
            int entry_completed = 1;
            for (int j = 0; j < 3; ++j) {
                if (map[i].leaf_count[j] == 0) { 
                    entry_completed = 0;
                    break;
                }
            }

            if (entry_completed) {
                // are there pending assignments? (we could do the assignments here, but that would duplicate code)
                int done = 1;
                for (int j = 0; j < 3; ++j) {
                    int node = map[i].connections[j];
                    if (node < leaf_count) continue;
                    // find connection
                    int branch = map[node].find_branch(i);
                    if (map[node].leaf_count[branch] == 0) {
                        done = 0;
                        break;
                    }
                }
                
                map[i].done = done;
                if (!done) all_done = 0;
            } else {
                all_done = 0;
            }
        }
        
        // everything is set and accounted for
        if (all_done) break; 

    }
}

QSearchConnectedNode  QSearchConnectedNodeMap::operator[](const unsigned int &i) const
{ 
    assert(i<map.size());
    return map[i];
}

QSearchConnectedNode& QSearchConnectedNodeMap::operator[](const unsigned int &i)
{ 
    assert(i<map.size());
    return map[i];
}

inline unsigned int QSearchConnectedNodeMap::next_node(const unsigned int &from, const unsigned int &to)
    { return map[from].connections[ map[from].node_branch[to] ]; }
