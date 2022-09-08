#ifndef __QSEARCH_MANAGER_H
#define __QSEARCH_MANAGER_H

#include "QSearchTree.hpp"

// callback function types
typedef std::function< void () > start_fn;
typedef std::function< void (QSearchTree&, QSearchTree&) > improve_fn;
typedef std::function< void (QSearchTree&) > done_fn;

// Callbacks called as tree improves over long runs. Can be simple alerts or complex animations.
// Observer no longer contains void* user_data - functors can contain their own state as needed
struct QSearchObserver {
    start_fn tree_search_started;
    improve_fn tried_to_improve;
    done_fn tree_search_done;

    QSearchObserver(start_fn& search_init, improve_fn improve_init, done_fn done_init)
        : tree_search_started(search_init), tried_to_improve(improve_init), tree_search_done(done_init)
        {}
};

// "stub" functor which contains one overload for each of the fu
struct tree_observer_adaptor {
    QMatrix<double>& dm;

    void operator () () {}                                  // start_fn
    void operator () (QSearchTree& a, QSearchTree& b) {}    //improve_fn
    void operator () (QSearchTree& a) {}                    // done_fn

    tree_observer_adaptor(QMatrix<double>& dm_init) : dm(dm_init) {}
};

typedef std::unique_ptr< QSearchTree > tree_ptr;

// Manages the search for a better tree and keeps user informed
// Uses "Manager" design pattern
struct QSearchManager
{
    std::vector< tree_ptr > forest;   // vector of pointers?
    QMatrix<double>  dm; // owner of matrix?
    std::vector< QSearchObserver > obs;  // vector of pointers?
    double lmsd;
    bool abort_search;

    QSearchManager(QMatrix<double>& dm_init);  // was QSearchTreeMaster *qsearch_treemaster_new(QMatrix<double> & dm);
    // destructor probably not needed - was void qsearch_treemaster_free(QSearchTreeMaster *clt);

    void add_observer( start_fn tree_search_started, improve_fn tried_to_improve, done_fn tree_search_done);
    void try_to_improve_bucket(unsigned int i);
    void find_best_tree(QSearchTree& result); // changed to call by reference
    bool was_search_stopped();
    void stop_search();
    double get_lmsd();
    bool is_done();

};



#endif //__QSEARCH_MANAGER_H
