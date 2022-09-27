
#include "QSearchFullTree.hpp"
#include "RandTools.hpp"

#include <cassert>

unsigned int QSearchFullTree::next_node(const unsigned int& from, const unsigned int& to) {
    return map[from].connections[ (int) map[from].node_branch[to] ];
}

static inline double npairs(double n) { return n * (n-1)/2; }

inline static int find_branch(int connections[3], int to) {
    if (connections[0] == to) return 0;
    if (connections[1] == to) return 1;
    if (connections[2] == to) return 2;
    assert(0); 
    return -1;
}

void QSearchFullTree::set_score() {
    // calculate the score
    raw_score = 0;
    int i;
    for (i = (node_count + 2)/2; i < node_count; ++i) {
        raw_score += npairs(map[i].leaf_count[0]) * map[i].dist[0];
        raw_score += npairs(map[i].leaf_count[1]) * map[i].dist[1];
        raw_score += npairs(map[i].leaf_count[2]) * map[i].dist[2];
    }
}


QSearchFullTree::QSearchFullTree(const QSearchTree& clt) : dm( clt.dm ) {
    
    unsigned int i,j; 
    unsigned int node_count = clt.total_node_count;
    unsigned int leaf_count = (node_count + 2)/2;
    
    node_count = clt.total_node_count;  // ?
    
    NodeList todo(node_count - leaf_count);
    if (map.size() < node_count) {
      map.resize(node_count);
    }

    for (i = 0; i < node_count; ++i) {
        FullNode& node = map[i];
        
        for (j = 0; j < 3; ++j) {
            map[i].connections[j] = -1;
            map[i].leaf_count[j] = 0;
            map[i].dist[j] = 0;
        }
        
        node.node_branch.resize(node_count);

        if (i < leaf_count) {
            for (j=0; j < node_count; ++j) node.node_branch[j] = 0;
            node.leaf_count[0] = leaf_count - 1;
        } else {
            for (j = 0; j < node_count; ++j) node.node_branch[j] = -1;
            todo[i - leaf_count] = i;
        } 
    }
     
    // set connections (construct tree)
    for (i = 0; i < node_count; ++i) {

        const QSearchNeighborList& cln = clt.n[i];
        // add to connected nodes
        for (j = 0; j < clt.n.size(); ++j) {
            unsigned int node = cln.n[j];
        
            // find unfilled branch
            int branch = find_branch(map[node].connections, -1);
            map[node].connections[branch] = i; // set connection
            
            if (i < leaf_count) {
                map[node].leaf_count[branch] = 1; // set leaf
            }
            map[node].node_branch[i] = branch; // leaf can be found in branch

            // set connection back to this node
            branch = find_branch(map[i].connections, -1);
            map[i].connections[branch] = node;
            map[i].node_branch[node] = branch;
        }
    }
    
    // every iteration, this loop progresses by at least finishing one node. Worst case is n^3 (for 'linear' trees)
    while (todo.size() > 0) {
        for (unsigned int i = 0; i < todo.size(); ++i) {
            
            unsigned int this_node = todo[i]; 
                        
            for (j = 0; j < 3; ++j) {
                unsigned int connected_node = map[this_node].connections[j];
                unsigned int branch = find_branch(map[connected_node].connections, this_node);

                if (map[connected_node].leaf_count[branch] == 0) {
                    unsigned int first = (3 + j-1) % 3;
                    unsigned int second = (j + 1)  % 3;
                    if (map[this_node].leaf_count[first] != 0 && map[this_node].leaf_count[second] != 0) {
                        map[connected_node].leaf_count[branch] = map[this_node].leaf_count[first] + map[this_node].leaf_count[second];
                        
                        // set the node_branch information
                        unsigned int k;
                        for (k = 0; k < node_count; ++k) {
                            // node present in one of the two branches pointing away from this
                            unsigned int node_present = k==this_node || map[this_node].node_branch[k] == first || map[this_node].node_branch[k] == second;
                            
                            if (node_present) map[connected_node].node_branch[k] = branch;
                        }
                    }
                }
            }
        }
        
        for (i = 0; i < todo.size(); ++i) {
            
            unsigned int this_node = todo[i];
             
            // we are done when all entries are set for this node, AND there are no pending assignments to neighbours

            // are all entries set for this node?
            for (j = 0; j < 3; ++j) {
                if (map[this_node].leaf_count[j] == 0) { 
                    break;
                }
            }

            // are there pending assignments? (we could do the assignments here, but that would duplicate code)
            int done = 1;
            for (j = 0; j < 3; ++j) {
                if (this_node < leaf_count) continue;
                unsigned int connected_node = map[this_node].connections[j];
                // find connection
                unsigned int branch = find_branch(map[connected_node].connections, this_node);
                if (map[connected_node].leaf_count[branch] == 0) {
                    done = 0;
                    break;
                }
            }
            
            if (done) {
                //printf("Removing node %d, counts %d %d %d\n", i, map[this_node].leaf_count[0], map[this_node].leaf_count[1], map[this_node].leaf_count[2]);
                todo.erase( todo.begin() + i );
                --i;
            }
        }
    }
        
    unsigned int k; 
    // now fill in the distances
    for (i=leaf_count; i < node_count; ++i) {
        for (j = 0; j < leaf_count; ++j) {
            for (k = j+1; k < leaf_count; ++k) {

                int b1 = map[i].node_branch[j];
                int b2 = map[i].node_branch[k];
                
                if (b1 == b2) continue;

                int b3 = 3 - b1 - b2;

                map[i].dist[b3] += dm[j][k];
            }
        }
    }
    
    set_score();
}
    
void QSearchFullTree::random_pair(unsigned int& a, unsigned int& b) 
{
    a = rand_range(0, node_count-1);
    b = a;
    
    while (b == a || move_to(a, b) == b ) b = rand_range(0, node_count-1);
}

bool QSearchFullTree::can_swap(const unsigned int& a, const unsigned int& b) 
{
   if (a == b) return false; // no point in doing anything
    
   unsigned int interiorA = map[a].connections[ map[a].node_branch[b] ];
   unsigned int interiorB = map[b].connections[ map[b].node_branch[a] ];
   
   if (interiorA == interiorB || interiorA == b) return false; // swap does not change score
   return true;
}

void QSearchFullTree::swap_nodes(const unsigned int& a, const unsigned int& b) 
{
   NodeList aNodes, bNodes;

   if (a == b) return; // no point in doing anything
    
   unsigned int interiorA = map[a].connections[ map[a].node_branch[b] ];
   unsigned int interiorB = map[b].connections[ (int) map[b].node_branch[a] ];
   
   if (interiorA == interiorB || interiorA == b) return; // swap does not change score
   
   unsigned int node_count = node_count;
   unsigned int leaf_count = (node_count + 2)/2;

   unsigned int aToInteriorBranch = map[a].node_branch[interiorA];
   unsigned int bToInteriorBranch = map[b].node_branch[interiorB];
   
   unsigned int countA = leaf_count - map[a].leaf_count[aToInteriorBranch];
   unsigned int countB = leaf_count - map[b].leaf_count[bToInteriorBranch];
   
   unsigned int interiorToABranch = map[interiorA].node_branch[a];
   unsigned int interiorToBBranch = map[interiorB].node_branch[b];
     
   // loop over internal nodes, swap node_branches from A <-> B
   unsigned int node = interiorA;
   
   //printf("Score before %f\n", raw_score);
    
   // store the nodes that need to be updated
   int i,j;
   for (i = 0; i < node_count; ++i) {
        if (i == a || map[a].node_branch[i] != aToInteriorBranch) {
            aNodes.push_back(i);
        }
        if (i == b || map[b].node_branch[i] != bToInteriorBranch) {
            bNodes.push_back(i);
        }
   }

   // move towards B 
   while (node != b) {

        int aBranch = map[node].node_branch[a];
        int bBranch = map[node].node_branch[b];
        int cBranch = 3 - aBranch - bBranch;
        
        raw_score -= npairs(map[node].leaf_count[0]) * map[node].dist[0];
        raw_score -= npairs(map[node].leaf_count[1]) * map[node].dist[1];
        raw_score -= npairs(map[node].leaf_count[2]) * map[node].dist[2];
        
        //printf("Node %d\n", node);
        //printf("Score now %f, distances %f %f %f\n", raw_score, map[node].dist[0], map[node].dist[1], map[node].dist[2]);
        
        map[node].leaf_count[aBranch] += countB - countA;
        map[node].leaf_count[bBranch] += countA - countB;
       
        // update the branches that point to elements from A 
        for (i = 0; i < aNodes.size(); ++i) {
            unsigned int aNode = aNodes[i];
            assert(map[node].node_branch[aNode] == aBranch);
            map[node].node_branch[aNode] = bBranch;
           
            // update distances 
            if (aNode < leaf_count) { // it's  a leaf
                for (j = 0; j < leaf_count; ++j) {
                    if (aNode==j) continue;
                    
                    double d = dm[aNode][j];

                    if (map[node].node_branch[j] == cBranch) {
                        map[node].dist[aBranch] += d;
                        map[node].dist[bBranch] -= d;
                    } else if (map[node].node_branch[j] == aBranch) {
                        map[node].dist[cBranch] += d;
                    } else {
                        map[node].dist[cBranch] -= d;
                    }
                }
            }
        } 
        
            
        // update the branches that point to elements from B
        for (i = 0; i < bNodes.size(); ++i) {
            unsigned int bNode = bNodes[i];
            assert(map[node].node_branch[bNode] == bBranch);
            map[node].node_branch[bNode] = aBranch;
                
            if (bNode < leaf_count) { // it's  a leaf
                for (j = 0; j < leaf_count; ++j) {
                    if (bNode==j) continue;
                    
                    double d = dm[bNode][j];

                    if (map[node].node_branch[j] == cBranch) {
                        map[node].dist[bBranch] += d;
                        map[node].dist[aBranch] -= d;
                    } else if (map[node].node_branch[j] == bBranch) {
                        map[node].dist[cBranch] += d;
                    } else {
                        map[node].dist[cBranch] -= d;
                    }
                }
            }
        }

        raw_score += npairs(map[node].leaf_count[0]) * map[node].dist[0];
        raw_score += npairs(map[node].leaf_count[1]) * map[node].dist[1];
        raw_score += npairs(map[node].leaf_count[2]) * map[node].dist[2];
        
        //printf("Score now2 %f, distances %f %f %f\n", raw_score, map[node].dist[0], map[node].dist[1], map[node].dist[2]);
        
        node = map[node].connections[ bBranch ];
   }
     
   // swap directions for A and B
   map[interiorA].connections[ interiorToABranch ] = b;
   map[interiorB].connections[ interiorToBBranch ] = a;
    
   // swap connections for A and b
   map[a].connections[ aToInteriorBranch ] = interiorB;
   map[b].connections[ bToInteriorBranch ] = interiorA;
}

std::unique_ptr< QSearchTree > QSearchFullTree::to_searchtree() 
{
    int leaf_count = (node_count + 2)/2;
    int i,j;
    std::unique_ptr< QSearchTree > clt( new QSearchTree(dm));

    // write out resulting tree in clt
    for (i = 0; i < leaf_count; ++i) {
        clt->leaf_placement[i] = i;
    }
    
    for (i = 0; i < node_count; ++i) {
        QSearchNeighborList& lst = clt->n[i];
        NodeList& n = lst.n;
        for (j = 0; j < 3; ++j) {
            unsigned int con = map[i].connections[j];
            if (con <= i) continue; // no need to write
            n.push_back(con);
        }
    }
    
    clt->score = (clt->dist_max - raw_score) / (clt->dist_max - clt->dist_min); 

    clt->must_recalculate_paths = true;
    clt->f_score_good = true;

    return clt;
}

unsigned int QSearchFullTree::move_to(unsigned int from, unsigned int to) {
    return map[from].connections[ map[from].node_branch[to] ];
}

unsigned int QSearchFullTree::find_sibling(unsigned int node, unsigned int ancestor) 
{
    assert(node != ancestor);
    unsigned int parent = QSearchFullTree::move_to(node, ancestor);
    assert(parent != ancestor);

    int branch2node = map[parent].node_branch[node];
    int branch2ancestor = map[parent].node_branch[ancestor];
    int branch2sibling = 3 - branch2node - branch2ancestor;

    return map[parent].connections[ branch2sibling ];
}

double  QSearchFullTree::sum_distance(int a, int b) 
{
    double sum = 0.0;

    int node = map[a].connections[ map[a].node_branch[b] ];
    int n = 0;
    while (node != b) {
        int toa = map[node].node_branch[a];
        int tob = map[node].node_branch[b];
        
        sum += npairs( map[node].leaf_count[ toa ] ) * map[node].dist[toa];
        sum += npairs( map[node].leaf_count[ tob ] ) * map[node].dist[tob];
        n++;
        node = map[node].connections[ tob ];
    }
    assert( n!=0 );
    return sum / n;
}

double  QSearchFullTree::sum_distance_org(const unsigned int& a, const unsigned int& b) 
{
    int branch2b = map[a].node_branch[b];
    int branch2a = map[b].node_branch[a];

    return npairs( map[a].leaf_count[branch2b] ) * map[a].dist[branch2b] + npairs( map[b].leaf_count[branch2a] ) * map[b].dist[branch2a];
}

void QSearchFullTree::get_children(const unsigned int&  node, const unsigned int& ancestor, unsigned int& child1, unsigned int& child2) 
{
    int branch = map[node].node_branch[ancestor];
    
    child1 = map[node].connections[ (3 + branch-1) % 3];
    child2 = map[node].connections[ (branch + 1) % 3];
}


