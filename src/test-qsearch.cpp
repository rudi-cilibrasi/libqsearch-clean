#include <SimpleMatrix.hpp>

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
}

// for stand-alone test
int main() {
  testQMatrix();
  return 0;
}
