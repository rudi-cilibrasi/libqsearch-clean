
#include <cmath> 
#include "QSearchTree.hpp"
#include "QSearchNeighborList.hpp"
#include "QSearchFullTree.hpp"
#include "SimpleMatrix.hpp"
#include "QSearchConnectedNode.hpp"

QSearchTree::QSearchTree(int how_many_leaves)
{
  assert(how_many_leaves >= 4);
  total_node_count = how_many_leaves * 2 - 2;
  int s = total_node_count;
  dist_calculated = false;

  // move to initializer
  for (int i = 0; i < s; i += 1) {
    nodeflags.push_back( NULL );
  }
  must_recalculate_paths = true;
  spm.resize(s,s);

  for (int i = 0; i < how_many_leaves - 2; i++ ) {
    connect(i, how_many_leaves + i);
    if (i > 0)
      connect(i + how_many_leaves-1, i + how_many_leaves);
  }
  connect(how_many_leaves - 2, how_many_leaves);
  connect(how_many_leaves-1, s-1);
  assert(s > 0);
//  j = 0;
  for (int i = 0; i < s; i += 1) {
    if (get_neighbor_count(i) == 1) {
      leaf_placement.push_back( i );
    }
  }
}

QSearchTree::QSearchTree(QSearchTree& q)
{
    QSearchTree( q.get_leaf_node_count() ); 
    must_recalculate_paths = true;
    f_score_good = q.f_score_good;
    score = q.score;
    ms = q.ms;
    ms.total_clonings += 1;
    dist_calculated = q.dist_calculated;
    dist_min = q.dist_min;
    dist_max = q.dist_max;
    leaf_placement = q.leaf_placement;
    n = q.n;    
}

QSearchTree::QSearchTree(QSearchTree& q, int howManyTries, const SimpleMatrix<unsigned int>& dm)
{
    if (!dist_calculated) {
        calc_min_max(dm);
        dist_calculated = 1;
    }
  
  //QSearchTree result;
  int i, totmuts;
  double candscore;
  double best_score;
  double curscore = score_tree(dm);
  std::unique_ptr< QSearchTree > cand, result;
#if QSOPENMP_ENABLED
  if (!g_thread_supported ()) g_thread_init (NULL);
#pragma omp parallel shared(result, curscore) private(i, totmuts, cand, candscore, best_score) firstprivate(howManyTries, dm, clt)
 {
#pragma omp for schedule (dynamic, 1)
#else
  howManyTries = 1;
  do {
#endif
  for (i = 0; i < howManyTries; i += 1) {
    cand.reset( new QSearchTree( q ) );
     
    //qsearch_tree_complex_mutation(cand);
    QSearchFullTree tree(*cand, dm);

    // perform node_count swaps, keep track of best
    best_score = tree.raw_score;
    totmuts = tree.node_count;//qsearch_tree_get_mutation_distribution_sample(clt);
    
    int j;
     
    for (j = 0; j < totmuts; ++j) {
        double beta = 1.0; // set to 0.0 to mimick random behaviour. This behaviour is a metropolis markov chain
         
        int p1, p2;
        tree.random_pair(&p1, &p2);

        double cur = tree.raw_score;

        if ( rand() % 3 < 2) { 
            
            tree.swap_nodes(p1, p2, dm);
            
            if (tree.raw_score <= best_score || fabs(tree.raw_score - best_score) < 1e-6) { 
                tree.to_searchtree(*cand);
                best_score = tree.raw_score;
                //printf("Score improved from %f to %f, raw: %f \n", curscore, cand->score, tree.raw_score);
            }

            // calculate acceptance
            double now = tree.raw_score;
            if (drand48() >= exp(beta * (cur-now) )) { // reject
                tree.swap_nodes(p1, p2, dm);
            } 

        } else { // transfer tree
            
            int interior = tree.move_to(p1, p2);
            assert(interior != p2);
             
            int sibling = tree.find_sibling(p1, p2);
           
            // move entire subtree containing p1 and sibling in the place of p2 
            tree.swap_nodes(interior, p2, dm);
            
            if (tree.raw_score <= best_score || fabs(tree.raw_score - best_score) < 1e-6) { 
                tree.to_searchtree(*cand);
                best_score = tree.raw_score;
                //printf("Score improved from %f to %f, raw: %f \n", curscore, cand->score, tree.raw_score);
            }
            
            // swap the sibling back in its original place (making 'node' a sibling of 'p2'
            tree.swap_nodes(sibling, p2, dm);
           
            // postcondition: 
            assert( tree.find_sibling(p1, sibling) == p2);

            if (tree.raw_score <= best_score || fabs(tree.raw_score - best_score) < 1e-6) { 
                tree.to_searchtree(*cand);
                best_score = tree.raw_score;
                //printf("Score improved from %f to %f, raw: %f \n", curscore, cand->score, tree.raw_score);
            }
            
            // calculate acceptance
            double now = tree.raw_score;
            if (drand48() >= exp(beta*(cur-now) )) { // reject
                tree.swap_nodes(sibling, p2, dm);
                tree.swap_nodes(interior, p2, dm);
            } 
        }
    }
    
    //tree.to_searchtree(cand);
    //qsearch_free_fulltree(tree);
    
    //cand->f_score_good = 0;
    //double org = cand->score;
    candscore  = cand->score_tree(dm);
    
    //if (fabs(org-cand->score) > 1e-6) {
    //    printf("Error, score should be %f, was %f\n", cand->score, org);
    //    exit(0);
    //}

    if (candscore <= curscore) {
      cand.reset();
      continue;
    }
#if QSOPENMP_ENABLED
#pragma omp critical
#endif
    if (candscore > curscore) {
      if (result)
      result.reset();
      std::swap(result,cand);
      curscore = candscore;
    }
    else
      cand.reset();
    }
#if QSOPENMP_ENABLED
}
#else
  } while (0);
#endif
  QSearchTree(*result);
}

unsigned int QSearchTree::get_node_count()
{
  return total_node_count;
}

unsigned int QSearchTree::get_leaf_node_count()
{
  return (total_node_count+2)/2;
}

unsigned int QSearchTree::get_kernel_node_count()
{
  return (total_node_count-2)/2;
}

// possibly return unique pointer? call by reference?
SimpleMatrix< unsigned int> QSearchTree::get_adjacency_matrix()
{
  int s = get_node_count();
  SimpleMatrix<unsigned int> m(s,s);
  int i, j;
  for (i = 0; i < s; i += 1) {
    for (j = i+1; j < s; j += 1) {
      int b = is_connected( i, j) ? 1 : 0;
      m[i][j] = b;
      m[j][i] = b;
    }
  }
  return m;
}

void QSearchTree::calc_min_max(const SimpleMatrix<unsigned int>& dm) {
    dist_min = 0;
    dist_max = 0;
    for (int i = 0; i < leaf_placement.size(); i += 1)
        for (int j = i+1; j < leaf_placement.size(); j += 1)
            for (int k = j+1; k < leaf_placement.size(); k += 1)
                for (int l = k+1; l < leaf_placement.size(); l += 1) {
                    double c1, c2, c3;
                    c1 = dm[i][j] + dm[k][l];
                    c2 = dm[i][k] + dm[j][l];
                    c1 = dm[i][l] + dm[j][k];
 
                    dist_min += std::min( c1, c2, c3 ); dist_max += std::max( c1, c2, c3 );
                }
    // wheee!!
}

bool QSearchTree::is_connected(const unsigned int& a, const unsigned int& b) 
{
    assert(a >= 0 && b >= 0 && a < total_node_count && b < total_node_count);
    if (a == b) return false;
    return a > b ? n[a].has_neighbor(b) : n[b].has_neighbor(a); // backwards?
}

bool QSearchTree::is_standard_tree()
{
  for (int i = 0; i < get_node_count(); i += 1) {
    int nc = get_neighbor_count(i);
    if (nc != 1 && nc != 3)
      return false;
  }
  return true;
}

unsigned int QSearchTree::get_neighbor_count(const unsigned int& a) {
  int acc = 0;
  for (unsigned int i = 0; i < total_node_count; i += 1)
    if (is_connected(i, a))
      acc += 1;
  return acc;
}

void QSearchTree::connect(const unsigned int& a, const unsigned int& b)
{
  assert(is_connected(a,b) == false);
  assert(a != b);
  if (a < b)
    n[a].add_neighbor(b);
  else
    n[b].add_neighbor(a);
  must_recalculate_paths = true;
  f_score_good = false;
}

void QSearchTree::disconnect(const unsigned int& a, const unsigned int& b)
{
  assert(is_connected(a,b) == true);
  assert(a != b);
  if (a < b)
    n[a].remove_neighbor(b);
  else
    n[b].remove_neighbor(a);
  must_recalculate_paths = true;
  f_score_good = false;
}

// changed to call by reference
void QSearchTree::find_path(std::vector<unsigned int>& result, unsigned int a, unsigned int b) {
  find_path_fast(result, a, b);
}

// changed argument order
void QSearchTree::find_path_fast(std::vector<unsigned int>& result, unsigned int a, unsigned int b)
{
  assert(a >= 0 && b >= 0 && a < total_node_count && b < total_node_count);
  freshen_spm();
  
  int step_counter = -1;
  for (;;) {    
    result.push_back(a);
    step_counter += 1;
    if (step_counter > total_node_count)
      break;
    if (a == b)
      break;
    a = spm[b][a];
  }
  if (a != b)
    std::cout << "Error, broken path from " << a << " to " << b << " for tree.\n";
}

void QSearchTree::freshen_spm()
{
  //guint32 target;
  if (!must_recalculate_paths)
    return;
  must_recalculate_paths = 0;
  assert(total_node_count > 1);
  //for (target = 0; target < total_node_count; target += 1)
  //  qsearch_calculate_spm_for(clt, nodeflags, target);

  QSearchConnectedNodeMap map(*this);
    
  int i,j;
  for (i=0;i<total_node_count;++i) {  
      auto& spm_connect = spm[i];
      for (j=0;j<total_node_count; ++j) {
         if (j==i) continue;
         // path from j to i
         spm_connect[j] = map[j].connections[ (int) map[j].node_branch[i] ]; 
      }
  }
}

bool QSearchTree::is_consistent_quartet(const int &a, const int &b, const int &c, const int &d)
{
  assert(get_neighbor_count(a) == 1);
  assert(get_neighbor_count(b) == 1);
  assert(get_neighbor_count(c) == 1);
  assert(get_neighbor_count(d) == 1);
  
  for( auto flag : nodeflags) flag &= ~NODE_FLAG_QUARTETINT;
  find_path_fast(p1, a, b);
  for( auto node : p1 ) nodeflags[node] |= NODE_FLAG_QUARTETINT;
  find_path_fast(p2, c, d);
  for( auto node : p2 ) if( nodeflags[node] & NODE_FLAG_QUARTETINT) return false;
  return true;
}