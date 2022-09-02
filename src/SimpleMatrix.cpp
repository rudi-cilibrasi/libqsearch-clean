#include <iostream>
#include "SimpleMatrix.hpp"

template<class T> inline void SimpleMatrix<T>::resize(const unsigned int &xdim, const unsigned int &ydim)
{
    m.resize(xdim);
    for(auto v : m) v.resize(ydim);
}

template<class T> inline std::__1::vector<T> SimpleMatrix<T>::operator[](const unsigned int &i) const
{ 
    assert(i<m.size());
    return m[i];
}

template<class T> inline std::__1::vector<T> &SimpleMatrix<T>::operator[](const unsigned int &i)
{ 
    assert(i<m.size());
    return m[i];
}

// test for SimpleMatrix - used as main() in initial testing
void testSimpleMatrix() {
    SimpleMatrix< unsigned int> a(3,4);
    
    a[2][3] = 1;
    std::cout << a[2][3] << "\n";
    a.resize(4,5);
    std::cout << a[2][3] << "\n";
}

// for stand-alone test
// int main() { testSimpleMatrix(); }

template class SimpleMatrix<unsigned int>;