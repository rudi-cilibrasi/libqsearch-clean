#include "QSearchMakeTree.hpp"
#include <emscripten/bind.h>

emscripten::val global_callback;

void onStart() {
    std::cout << "onStart" << std::endl;
}

void onImprove(QSearchTree& old, QSearchTree& improved) {
    std::cout << "onImprove" << std::endl;
    std::string treeJson = improved.to_json();
//    std::cout << treeJson << std::endl;
    global_callback(treeJson);
}

void onDone(QSearchTree& final) {
    std::cout << "onDone" << std::endl;
    std::string treeJson = final.to_json();
    global_callback(treeJson);
}

// Modified run_qsearch function to accept the NCD matrix as input
extern "C" {

    void run_qsearch(const std::string matstr,  emscripten::val callback) {
        global_callback = callback;
        QSearchMakeTree mt;
        std::cout << "Running QSearch with matrix: " << matstr << std::endl;
        mt.make_tree(matstr, onStart, onImprove, onDone);
    }

// Binding the modified run_qsearch function
EMSCRIPTEN_BINDINGS(my_module) {
    emscripten::function("run_qsearch", &run_qsearch);
}
}