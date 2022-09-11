#include <SimpleMatrix.hpp>

// test for QMatrix - used as main() in initial testing
void testQMatrix()
{
  QMatrix<unsigned int> a(4);

  a[2][3] = 1;
  std::cout << a[2][3] << "\n";
  a.resize(5);
  std::cout << a[2][3] << "\n";
}

// for stand-alone test
int main() {
  testQMatrix();
  return 1;
}
