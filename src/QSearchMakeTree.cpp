#include "QSearchMakeTree.hpp"

static QSearchMakeTree *qsmaketree;
static const std::string qsearch_package_version = "0.7.1"; 

void MakeTreeObserver::operator()(QSearchTree& old, QSearchTree& improved)
{
    std::cout << improved.score_tree() << "   (lmsd=" << mtr.tm.get_lmsd() << ")\n";
    // mtr.tree = qsearch_tree_add_labels(improved, mtr.mat); obsolete?
    make_tree.write_tree_file(mtr);
}

void MakeTreeObserver::operator()(QSearchTree& final)
{
    std::cout << final.score_tree() << "\n";
    // mtr.tree = qsearch_tree_add_labels(final, mtr.mat);obsolete?
    make_tree.write_tree_file(mtr);
}

MakeTreeResult QSearchMakeTree::process_options(char **argv) 
{
    QMatrix<double> lm;     // owner of matrix?
    std::string matstr;
    char **cur;
    for (cur = argv+1; *cur; cur += 1) {
      if (strcmp(*cur, "-o") == 0) {
      if (cur[1] == NULL)
        std::cout << "-o requires an argument";
        filestem = cur[1];
        cur += 1;
        continue;
      }
      if (strcmp(*cur, "-v") == 0 || strcmp(*cur, "--version") == 0) {
        printf("%s\n", qsearch_package_version);
        exit(0);
      }
      if (strcmp(*cur, "-n") == 0) {
        output_nexus = true;
        continue;
      }
      if (matrix_filename.length() == 0) {
        matrix_filename = *cur;
        continue;
      }
      std::cout << "Unrecognized argument: " << *cur;
    }
    if (matrix_filename.empty())
    print_help_and_exit();
    read_whole_file(matstr, matrix_filename);
    lm.from_string(matstr);
    std::cout << "Starting search on matrix size " << lm.dim << "\n";
    QSearchManager cltm(lm);
    QSearchTree tree(lm);
    MakeTreeResult mtr(cltm,tree);
    mtr.mat = lm;
    mtr.tm = cltm;
    MakeTreeObserver mto( *this, mtr );
    cltm.add_observer(mto, mto, mto);
    QSearchTree answer(lm);
    cltm.find_best_tree(answer);
    return mtr;
}

void QSearchMakeTree::write_tree_file(const MakeTreeResult& mtr) {
  if (output_nexus) {
    /* deferred
    char *fname = g_strdup_printf("%s.nex", top().get_filestem());
    char *nex_str = qsearch_tree_to_nexus_full(mtr.tree, mtr.mat);
    GString *gf = g_string_new(nex_str);
    complearn_write_file(fname, gf); 
    */
  }
  else {
    std::string fname = filestem + ".dot";
    write_whole_file(fname, mtr.tree.to_dot());
  }
}

void QSearchMakeTree::print_help_and_exit() 
{
  std::cout << "Usage:\n\n";
  std::cout << "maketree [-v] [-n] <distmatrix>\n";
  std::cout << "          -v  print version\n";
  std::cout << "          -n  nexus instead of dot output format\n";
  exit(0);
}
