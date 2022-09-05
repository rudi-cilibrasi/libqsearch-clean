#ifndef __SIMPLE_MATRIX_HPP
#define __SIMPLE_MATRIX_HPP

#include <vector>
#include <optional>
#include <iostream>

// Minimal matrix class supports only storage and retrieval of data
// No matrix math, but it could be extended to include this
template<class T> struct QMatrix {
    std::vector< std::vector<T> > m;
    std::optional< std::vector<std::string> > labels;
    unsigned int dim;   // matrix constrained to be square

    QMatrix() {}
    QMatrix(const unsigned int& dim_init, std::optional< std::vector<std::string> > labels_init = std::nullopt ) 
        : dim(dim_init), labels(labels_init), m(dim, std::vector<T>(dim)) {}

    std::vector<T>  operator [](const unsigned int& i) const; 
    std::vector<T>& operator [](const unsigned int& i);

    void resize(const unsigned int& new_dim);
};
#endif // __SIMPLE_MATRIX_HPP