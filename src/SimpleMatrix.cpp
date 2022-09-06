#include <iostream>
#include "SimpleMatrix.hpp"

template<class T> inline void QMatrix<T>::resize(const unsigned int &dim)
{ m.resize(dim); for(auto v : m) v.resize(dim); }

template<class T> inline std::__1::vector<T> QMatrix<T>::operator[](const unsigned int &i) const
{ assert(i<m.size()); return m[i]; }

template<class T> inline std::__1::vector<T> &QMatrix<T>::operator[](const unsigned int &i)
{ assert(i<m.size()); return m[i]; }

// test for QMatrix - used as main() in initial testing
void testQMatrix() {
    QMatrix< unsigned int> a(4);
    
    a[2][3] = 1;
    std::cout << a[2][3] << "\n";
    a.resize(5);
    std::cout << a[2][3] << "\n";
}

// for stand-alone test
// int main() { testQMatrix(); }

template class QMatrix<unsigned int>;
template class QMatrix<double>;