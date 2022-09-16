#include "QSearchManager.hpp"
#include <cmath>

static int recommended_tree_duplicity(int how_many_leaves)
{
  double v = how_many_leaves;
  v = 26 * pow(v, -0.76) + 0.5;
  int i = (int) v;
  if (i < 2)
    i = 2;
  return i;
}

QSearchManager::QSearchManager(QMatrix<double>& dm_init): dm(dm_init)  // was QSearchTreeMaster *new(QMatrix& dm);
{
  int fs = recommended_tree_duplicity(dm.dim);
  for (int i = 0; i < fs; i++) {
    forest.push_back( tree_ptr( new QSearchTree( dm ) ) );
    forest[i]->complex_mutation();
    forest[i]->complex_mutation();
  }
}

void QSearchManager::add_observer(  start_fn tree_search_started, improve_fn tried_to_improve, 
                                    done_fn tree_search_done ) 
{
  QSearchObserver cp(tree_search_started, tried_to_improve, tree_search_done);
  obs.push_back(cp);
}

void QSearchManager::try_to_improve_bucket(unsigned int i)
{
  const int NUMTRIESPERBIGTRY = 24; // can this constant live somewhere else?
  int j;

  auto& old = forest[i];
  tree_ptr cand = old->find_better_tree(NUMTRIESPERBIGTRY) ; // find better tree
  if (!was_search_stopped() && i == 0 && obs.size() > 0) {
    for(auto& ob : obs) { ob.tried_to_improve(*old, *cand); }
  }
  std::swap( old, cand ); // rather than setting one equal to the other, as they are unique
}

QSearchTree QSearchManager::find_best_tree()
{
  int i, j;
  double bestsco = -1.0;
  double osco, nsco;
  abort_search = false;
  for(auto ob: obs) ob.tree_search_started();
  do {
    for (i = 0; i < forest.size(); i += 1) {
      osco = forest[i]->score_tree();
      try_to_improve_bucket(i);
      nsco = forest[i]->score_tree();
      if (nsco < osco) {
        fprintf(stderr, "Error, tree degraded: %f %f.\n", osco, nsco);
        exit(1);
      }
      if (nsco > bestsco)
        bestsco = nsco;
    }
  } while (!is_done());
  QSearchTree& answer = *forest[0];
  double gsco;
  gsco = answer.score_tree();
  if (!was_search_stopped()) {
  if (fabs(gsco - bestsco) > 1e-6) {
//    fprintf(stderr, "WARNING: Best score was %f but gsco was %f\n", bestsco, gsco);
    ;
  }
  }
  if (!was_search_stopped() && obs.size() > 0) {
    for (auto& ob : obs) { ob.tree_search_done(answer); }
  }
  return answer;
}

bool QSearchManager::was_search_stopped()
{
  return abort_search;
}

void QSearchManager::stop_search()
{
  abort_search = true;
}

double QSearchManager::get_lmsd()
{
  return lmsd;
}

bool QSearchManager::is_done()
{
  const double MAXSCOREDIFF = 8e-14;
  if (abort_search)
    return true;
  lmsd = -1.0;
  QSearchTree& orig = *forest[0];
  double csco = orig.score_tree();
  int i;
  for(auto& tree : forest) {
    double sco = tree->score_tree();
    double deltasco = fabs(sco - csco);
    if (lmsd == -1.0 || lmsd < deltasco)
      lmsd = deltasco;
    if (lmsd > MAXSCOREDIFF)
      return false;
  }
  return true;
}