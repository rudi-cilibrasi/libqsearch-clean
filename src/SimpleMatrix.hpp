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

    QMatrix() : dim(0), labels(std::nullopt), m() {}
    QMatrix(const unsigned int& dim_init, std::optional< std::vector<std::string> > labels_init = std::nullopt ) 
        : dim(dim_init), labels(labels_init), m(dim_init, std::vector<T>(dim_init)) {}

    std::vector<T>  operator [](const unsigned int& i) const; 
    std::vector<T>& operator [](const unsigned int& i);
    //friend std::ostream& operator<< <T> (std::ostream& os, const QMatrix<T>& q);

    void to_string(std::string& s);
    void from_string( const std::string& s );
    void resize(const unsigned int& new_dim);
};

/*
template< class T > std::ostream& operator<< (std::ostream& os, const QMatrix<T>& q)
{ 
    if( q.labels.has_value() ) {
        auto label_it = q.labels.begin();
        for( auto v : q.m ) {
            os << *label_it;
            for( auto a : v ) os << " " << a;
            os << "\n";
            label_it++;
        }
    }
    else {
        for( auto v : q.m ) {
            for( auto a : v ) os << " " << a;
             os << "\n";
        }
    }
}
*/

#endif // __SIMPLE_MATRIX_HPP
