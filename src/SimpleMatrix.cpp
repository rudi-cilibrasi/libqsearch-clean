#include <iostream>
#include "SimpleMatrix.hpp"

template<class T> inline void QMatrix<T>::resize(const unsigned int &dim)
{ m.resize(dim); for(auto v : m) v.resize(dim); }

template<class T> inline std::vector<T> QMatrix<T>::operator[](const unsigned int &i) const
{ assert(i<m.size()); return m[i]; }

template<class T> inline std::vector<T> &QMatrix<T>::operator[](const unsigned int &i)
{ assert(i<m.size()); return m[i]; }

template<class T> bool QMatrix<T>::has_labels()
{ return ( labels.size() != 0 );  }

template<class T> void QMatrix<T>::to_string(std::string& s) 
{
    s.clear();
    if( has_labels() ) {
        auto label_it = labels.begin();
        for( auto v : m ) {
            s += *label_it;
            for( auto a : v ) { 
                s += " "; 
                s += std::to_string(a);
            }
            s +=  "\n";
            label_it++;
        }
    }
    else {
        for( auto v : m ) {
            for( auto a : v ) {
                s += " ";
                s += std::to_string(a);
            }
            s +=  "\n";
        }
    }
}

template<class T> void QMatrix<T>::from_string( const std::string& s ) 
{
    m.clear();
    labels.clear();
    StringList rows;
    // std::cout << "Reading rows\n";
    segment_string( rows, s, '\n' );   // break string into rows

    print_string_list( rows, "\n" );

    dim = rows.size();
    // std::cout << "matrix size " << dim << "\n";
    m.resize( dim );
    auto row_it = m.begin();
    // std::cout << "\nReading values from each row\n";
    for( auto& row_str : rows ) {
        StringList values;
        row_str += " "; // add a space, just cuz
        segment_string( values, row_str, ' ' );
        if( values.size() == dim + 1 ) {    // has label
            labels.push_back( values[0] );
            values.erase( values.begin() );
        }

        //print_string_list( values, " " );
        // std::cout << "\n";

        assert( values.size() == dim );
        for( auto& value : values) row_it->push_back( (T)std::stod( value ) );
        row_it++;
    }
    assert( ( labels.size() == 0 ) || ( labels.size() == dim ) );
}

template class QMatrix<unsigned int>;
template class QMatrix<double>;