
#include <cmath> 
#include "QSearchTree.hpp"
#include "QSearchNeighborList.hpp"
#include "QSearchFullTree.hpp"
#include "SimpleMatrix.hpp"

QSearchTree::QSearchTree(int how_many_leaves)
{
  assert(how_many_leaves >= 4);
  total_node_count = how_many_leaves * 2 - 2;
  int s = total_node_count;
  dist_calculated = false;

  for (int i = 0; i < s; i += 1) {
    nodeflags.push_back( NULL );
  }
  must_recalculate_paths = true;
  for (int i = 0; i < s; i += 1) {
    n.push_back( std::unique_ptr< QSearchNeighborList >( new QSearchNeighborList ) );
    spm.push_back( std::unique_ptr< std::vector< unsigned int > >( new std::vector< unsigned int >( s ) ) );
  }
  for (int i = 0; i < how_many_leaves - 2; i += 1) {
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

QSearchTree::QSearchTree(QSearchTree& q, int howManyTries, const gsl_matrix& dm)
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

// possibly return unique pointer?
SimpleMatrix< unsigned int> QSearchTree::get_adjacency_matrix()
{
  int s = get_node_count();
  gsl_matrix *m = gsl_matrix_calloc(s,s);
  int i, j;
  for (i = 0; i < s; i += 1) {
    for (j = i+1; j < s; j += 1) {
      int b = is_connected( i, j) ? 1 : 0;
      gsl_matrix_set(m, i, j, b);
      gsl_matrix_set(m, j, i, b);
    }
  }
  return m;
}

void QSearchTree::calc_min_max(const gsl_matrix& dm) {
    dist_min = 0;
    dist_max = 0;
    for (int i = 0; i < leaf_placement.size(); i += 1)
        for (int j = i+1; j < leaf_placement.size(); j += 1)
            for (int k = j+1; k < leaf_placement.size(); k += 1)
                for (int l = k+1; l < leaf_placement.size(); l += 1) {
                    double c1, c2, c3;
                    c1  = gsl_matrix_get(dm, i, j) + gsl_matrix_get(dm, k, l);
                    c2  = gsl_matrix_get(dm, i, k) + gsl_matrix_get(dm, j, l);
                    c3  = gsl_matrix_get(dm, i, l) + gsl_matrix_get(dm, j, k);

                    dist_min += std::min( c1, c2, c3 ); dist_max += std::max( c1, c2, c3 );
                }
    // wheee!!
}

bool QSearchTree::is_connected(const unsigned int& a, const unsigned int& b) 
{
    assert(a >= 0 && b >= 0 && a < total_node_count && b < total_node_count);
    if (a == b) return false;
    return a > b ? n[b]->has_neighbor(a) : n[b]->has_neighbor(a);
}