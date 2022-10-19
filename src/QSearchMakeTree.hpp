#ifndef __QSEARCH_MAKE_TREE_H
#define __QSEARCH_MAKE_TREE_H

#include "QSearchManager.hpp"

// Should this structure own the objects or hold references?
struct MakeTreeResult {
    QSearchManager& tm;
    QMatrix<double>& mat; 
    QSearchTree& tree;

    MakeTreeResult( QSearchManager& tm_init, QSearchTree& tree_init ) : tm( tm_init ), tree( tree_init ), mat( tree_init.dm ) {}
};

struct QSearchMakeTree
{
    std::string matrix_filename;
    bool output_nexus;            // flag indicating whether to use Nexus output format
    bool dot_show_ring;           // show dotted-line perimeter ring for dot tree
    bool dot_show_details;        // show various extra data in dot output
    std::string filestem;         // initial part of output filename without extension
    std::string dot_title;        // title for the output .dot tree file

    QSearchMakeTree() : 
        output_nexus(false), 
        dot_show_ring(true), 
        dot_show_details(true), 
        filestem("treefile"), 
        dot_title("tree")
    {}

    void process_options(char **argv);
    void process_options_unix(char **argv);
    void process_options_web(char **argv);
    void write_tree_file(QSearchTree& tree);
    void print_help_and_exit();
};

// Functor encapsulating callbacks 
struct MakeTreeObserver {
    QMatrix<double>& dm;
    QSearchMakeTree& make_tree;
    MakeTreeResult& mtr;

    void operator () () {}                                      // start_fn
    void operator () (QSearchTree& old, QSearchTree& improved); // improve_fn
    void operator () (QSearchTree& final);                      // done_fn

    MakeTreeObserver(QSearchMakeTree& make_tree_init, MakeTreeResult& mtr_init) 
        : dm(mtr_init.mat), make_tree(make_tree_init), mtr(mtr_init) {}
};

#endif // __QSEARCH_MAKE_TREE_H
