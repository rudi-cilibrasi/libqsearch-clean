#include "QSearchMakeTree.hpp"
#include <emscripten/bind.h>


// Modified run_qsearch function to accept the NCD matrix as input
void run_qsearch(const std::string matstr) {
    QSearchMakeTree mt;
    std::cout << "Running QSearch with matrix: " << matstr << std::endl;
    mt.make_tree(matstr); 
}

// Binding the modified run_qsearch function
EMSCRIPTEN_BINDINGS(my_module) {
    emscripten::function("run_qsearch", &run_qsearch);
}
