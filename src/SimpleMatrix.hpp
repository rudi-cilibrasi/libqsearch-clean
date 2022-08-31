#include <vector>
#include <iostream>

// Minimal matrix class supports only storage and retrieval of data
// No matrix math, but it could be extended to include this
template<class T> class SimpleMatrix {
    std::vector< std::vector<T> > m;

public:
    SimpleMatrix() {}
    SimpleMatrix(const unsigned int& xdim, const unsigned int& ydim) : m(xdim, std::vector<T>(ydim)) {}

    void resize(const unsigned int& xdim, const unsigned int& ydim);
    std::vector<T> operator [](const unsigned int& i) const; 
    std::vector<T>& operator [](const unsigned int& i); 
};
