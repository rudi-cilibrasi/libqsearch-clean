cmake_minimum_required(VERSION 3.16)

project(libqsearch)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE "Debug")
  message(STATUS "Build type not specified: Use Debug by default")
endif(NOT CMAKE_BUILD_TYPE)

include_directories(src)
set(CMAKE_CXX_STANDARD 20)

# TODO
# src/QSearchFullTree.cpp
# src/QSearchConnectedNode.cpp
# src/QSearchMakeTree.cpp
# src/QSearchManager.cpp
# src/QSearchNeighborList.cpp
# src/QSearchTree.cpp
# src/QSearchTree.hpp
# src/QSearchNeighborList.hpp

set(QSEARCH_LIB_SRCS
src/QSearchConnectedNode.hpp
src/QSearchFullTree.hpp
src/QSearchMakeTree.hpp
src/QSearchManager.hpp
src/RandTools.hpp
src/SimpleMatrix.cpp
src/SimpleMatrix.hpp
)

add_library(qsearch ${QSEARCH_LIB_SRCS})

set(MAKETREE_MAIN_SRCS src/maketree.cpp)
add_executable(maketree ${MAKETREE_MAIN_SRCS})

set(TESTQSEARCH_MAIN_SRCS src/test-qsearch.cpp)
add_executable(test-qsearch ${TESTQSEARCH_MAIN_SRCS})
target_link_libraries(test-qsearch qsearch)

target_link_libraries(maketree qsearch)
