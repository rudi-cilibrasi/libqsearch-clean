#ifndef __SIMPLE_MATRIX_HPP
#define __SIMPLE_MATRIX_HPP

#include <vector>
#include <optional>
#include <iostream>

typedef std::vector<std::string> StringList;

// Breaks a string up into a vector of substrings wherever separated by a given character
void segment_string( StringList& v, const std::string& s, const unsigned char c );

// Minimal matrix class supports only storage and retrieval of data
// No matrix math, but it could be extended to include this
template<class T> struct QMatrix {
    std::vector< std::vector<T> > m;
    StringList labels;
    unsigned int dim;   // matrix constrained to be square

    QMatrix() : dim(0), labels(), m() {}
    QMatrix(const unsigned int& dim_init ) 
        : dim(dim_init), labels(), m(dim_init, std::vector<T>(dim_init)) {}
    QMatrix(const unsigned int& dim_init, const StringList& labels_init) 
        : dim(dim_init), labels(labels_init), m(dim_init, std::vector<T>(dim_init)) {}

    std::vector<T>  operator [](const unsigned int& i) const; 
    std::vector<T>& operator [](const unsigned int& i);

    bool has_labels();
    void to_string(std::string& s);
    void from_string( const std::string& s );
    void resize(const unsigned int& new_dim);
};

#endif // __SIMPLE_MATRIX_HPP
