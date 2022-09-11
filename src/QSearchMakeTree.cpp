#include "QSearchMakeTree.hpp"

static QSearchMakeTree *qsmaketree;

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
    QMatrix<double>& dm;     // reference or pointer? who owns matrix?
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
        if (qsmt->_priv->matrix_filename == NULL) {
        qsmt->_priv->matrix_filename = *cur;
        continue;
    }
    std::cout << "Unrecognized argument: " << *cur;
    }
    if (matrix_filename.empty())
    print_help_and_exit();
    matstr = complearn_read_whole_file(qsmt->_priv->matrix_filename);
    lm = complearn_load_any_matrix(matstr);
    dm = lm->mat;
    printf(_("Starting search on matrix size %d.\n"), dm->size1);
    QSearchTreeMaster *cltm = qsearch_treemaster_new(dm);
    MakeTreeResult *mtr = calloc(sizeof(*mtr), 1);
    mtr.mat = lm;
    mtr.tm = cltm;
    qsearch_treemaster_add_observer(cltm, tree_search_started,
        tried_to_improve, tree_search_done, mtr);
    qsearch_treemaster_find_best_tree(cltm);
    return mtr;
}

void QSearchMakeTree::write_tree_file(const MakeTreeResult& mtr) {
  bool do_nexus = top().get_output_nexus();
  if (do_nexus) {
    char *fname = g_strdup_printf("%s.nex", top().get_filestem());
    char *nex_str = qsearch_tree_to_nexus_full(mtr.tree, mtr.mat);
    GString *gf = g_string_new(nex_str);
    complearn_write_file(fname, gf); 
  }
  else {
    char *fname = g_strdup_printf("%s.dot", filestem );
    complearn_write_file(fname, qsearch_tree_to_dot(mtr.tree));
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
