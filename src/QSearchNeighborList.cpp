#include "QSearchNeighborList.hpp"
#include <cassert>
#include <iostream>

unsigned int QSearchNeighborList::operator[](const unsigned int& i) const { return n[i]; }

int QSearchNeighborList::size() const { return n.size(); }

void QSearchNeighborList::clear() { n.clear(); }

int QSearchNeighborList::find_index(const unsigned int& w)
{
  for( int i = 0; i<n.size(); i++) if (n[i] == w) return i;
  return -1;
}

bool QSearchNeighborList::has_neighbor(const unsigned int& w)
{
  return find_index(w) != -1;
}

void QSearchNeighborList::remove_neighbor(const unsigned int& w)
{
  assert(has_neighbor(w));
  n.erase( n.begin() + find_index(w) );
}

void QSearchNeighborList::add_neighbor(const unsigned int& w)
{
  assert( w != 4294967295 );
  assert(has_neighbor(w) == false);
  n.push_back(w);
}

/*
int main() {
  QSearchNeighborList a;

  std::cout << "find_index " << a.find_index(1) << "\n";
  std::cout << "has_neighbor " << a.has_neighbor(1) << "\n";
  std::cout << "add_neighbor\n"; 
  a.add_neighbor(1);
  std::cout << "has_neighbor " << a.has_neighbor(1) << "\n";
  std::cout << "find_index " << a.find_index(1) << "\n";
  std::cout << "remove_neighbor\n";
  a.remove_neighbor(1);
  std::cout << "complete\n";

  return 1;
}
*/
 