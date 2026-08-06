#include "QSearchMakeTree.hpp"
#include "RandTools.hpp"
#include <cstdint>
#include <emscripten/bind.h>
#include <iomanip>
#include <sstream>
#include <stdexcept>

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

// Legacy callback binding retained for compatibility with older clients.
void run_qsearch(const std::string matstr, emscripten::val callback) {
        global_callback = callback;
        QSearchMakeTree mt;
        std::cout << "Running QSearch with matrix: " << matstr << std::endl;
        mt.make_tree(matstr, onStart, onImprove, onDone);
}

std::string run_qsearch_seeded(const std::string& matstr, const std::uint32_t seed) {
        seed_random(seed);
        QMatrix<double> distance_matrix;
        distance_matrix.from_string(matstr);
        distance_matrix.make_symmetric();
        if (distance_matrix.dim < 4) {
            throw std::invalid_argument("QSearch requires at least four objects");
        }

        QSearchManager manager(distance_matrix);
        QSearchTree tree = manager.find_best_tree();
        const double score = tree.score_tree();

        std::ostringstream result;
        result << std::setprecision(17)
               << "{\"seed\":" << seed
               << ",\"score\":" << score
               << ",\"tree\":" << tree.to_json()
               << "}";
        return result.str();
}

// Binding the modified run_qsearch function
EMSCRIPTEN_BINDINGS(my_module) {
    emscripten::function("run_qsearch", &run_qsearch);
    emscripten::function("run_qsearch_seeded", &run_qsearch_seeded);
}
