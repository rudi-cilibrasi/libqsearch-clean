#include "QSearchMakeTree.hpp"
#include <emscripten/bind.h>

void run_qsearch() {
    QSearchMakeTree mt;
    std::string matstr;
    read_whole_file(matstr, "samples/SmallTest.txt");
    mt.make_tree(matstr);    
    read_whole_file(matstr, "samples/Mammals.txt");
    mt.make_tree(matstr);
}

EMSCRIPTEN_BINDINGS(my_module) {
    emscripten::function("run_qsearch", &run_qsearch);
}