#include "QSearchNeighborList.hpp"
#include <cassert>

int QSearchNeighborList::find_index(const unsigned int& w)
{
  for (int i = 0; i < n.size(); i++)
    if (n[i] == w)
      return i;
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
  assert(has_neighbor(w) == false);
  n.push_back(w);
}


