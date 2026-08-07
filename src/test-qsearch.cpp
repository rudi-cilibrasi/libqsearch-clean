#include "SimpleMatrix.hpp"
#include "QSearchManager.hpp"
#include "RandTools.hpp"
#include <cassert>

// test for QMatrix - used in main() in initial testing
void testQMatrix() {
    QMatrix< unsigned int> q;
    /*
    for( int i=0; i<q.dim; i++ ) {
        for( int j=0; j<q.dim; j++ ) {
            q[i][j] = i*j;
        }
    } 
    q.labels = { "zero", "one", "two", "three" };
    */
    std::string input = "zero 0 0 0 0\none 0 1 2 3\ntwo 0 2 4 6\nthree 0 3 6 9\n";
    q.from_string( input );
    std::string s;  
    q.to_string(s);
    std::cout << "\nString produced by matrix\n";
    std::cout << s;
    std::cout << "\n";
    write_whole_file( s, "../samples/squares.txt");
    read_whole_file( s, "../samples/mammals.txt");
    q.from_string(s);
    std::cout << "\nMatrix read from file\n";
    std::cout << s;
    std::cout << "\n";
}

std::string seeded_tree(const std::string& input, const std::uint32_t seed) {
    QMatrix<double> matrix;
    matrix.from_string(input);
    matrix.make_symmetric();
    seed_random(seed);
    QSearchManager manager(matrix);
    QSearchTree tree = manager.find_best_tree();
    return tree.to_json();
}

void test_seeded_search_is_reproducible() {
    const std::string input =
        "a 0 0.1 0.8 0.9\n"
        "b 0.1 0 0.85 0.88\n"
        "c 0.8 0.85 0 0.12\n"
        "d 0.9 0.88 0.12 0\n";
    const std::string first = seeded_tree(input, 0x12345678U);
    const std::string second = seeded_tree(input, 0x12345678U);
    assert(first == second);
}

// for stand-alone test
int main() {
  testQMatrix();
  test_seeded_search_is_reproducible();
  return 0;
}
