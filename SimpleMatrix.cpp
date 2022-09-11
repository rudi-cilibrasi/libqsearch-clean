#include <iostream>
#include "SimpleMatrix.hpp"

template<class T> inline void QMatrix<T>::resize(const unsigned int &dim)
{ m.resize(dim); for(auto v : m) v.resize(dim); }

template<class T> inline std::__1::vector<T> QMatrix<T>::operator[](const unsigned int &i) const
{ assert(i<m.size()); return m[i]; }

template<class T> inline std::__1::vector<T> &QMatrix<T>::operator[](const unsigned int &i)
{ assert(i<m.size()); return m[i]; }

template<class T> void QMatrix<T>::to_string(std::string& s) 
{
    if( labels.has_value() ) {
        auto label_it = labels->begin();
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


template<class T> void QMatrix<T>::from_string( const std::string& s ) {}

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

// test for QMatrix - used in main() in initial testing
void testQMatrix() {
    QMatrix< unsigned int> q(4);
    for( int i=0; i<q.dim; i++ ) {
        for( int j=0; j<q.dim; j++ ) {
            q[i][j] = i*j;
        }
    }
    q.labels = { "zero", "one", "two", "three" };
    std::string s;  
    q.to_string(s);
    std::cout << s;
}

// for stand-alone test
int main() { testQMatrix(); return 0; }

template class QMatrix<unsigned int>;
template class QMatrix<double>;