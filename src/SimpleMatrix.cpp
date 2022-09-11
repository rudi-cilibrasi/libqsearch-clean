#include "SimpleMatrix.hpp"

#include <iostream>
#include <cassert>

template<class T> inline void QMatrix<T>::resize(const unsigned int &dim)
{ m.resize(dim); for(auto v : m) v.resize(dim); }

template<class T> inline std::vector<T> QMatrix<T>::operator[](const unsigned int &i) const
{ assert(i<m.size()); return m[i]; }

template<class T> inline std::vector<T> &QMatrix<T>::operator[](const unsigned int &i)
{ assert(i<m.size()); return m[i]; }

template class QMatrix<unsigned int>;
template class QMatrix<double>;