# Custom makefile for emscripten
MAKEFLAGS += --no-builtin-rules

# List of source files to include in the build
SRC_FILES := \
    src/QSearchWeb.cpp \
    src/QSearchConnectedNode.cpp \
    src/QSearchFullTree.cpp \
    src/QSearchMakeTree.cpp \
    src/QSearchManager.cpp \
    src/QSearchNeighborList.cpp \
    src/QSearchTree.cpp \
    src/SimpleMatrix.cpp \
    src/StringTools.cpp

# Corresponding object files in web_build directory
OBJ_FILES := $(patsubst src/%.cpp,web_build/%.o,$(SRC_FILES))

all: qsearch_html/qsearch.js

# Include dependency files
-include $(OBJ_FILES:.o=.d)

qsearch_html/qsearch.js: $(OBJ_FILES)
	em++ $(OBJ_FILES) -o qsearch_html/qsearch.js --embed-file samples -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE -s SINGLE_FILE=1 -s ENVIRONMENT=web -s NO_DISABLE_EXCEPTION_CATCHING -s EXPORT_ES6=1 -lembind

# Compile each source file with custom optimization flag
web_build/QSearchWeb.o: src/QSearchWeb.cpp
	em++ -O3 -MMD -MP -std=c++20 src/QSearchWeb.cpp -c -o web_build/QSearchWeb.o

web_build/QSearchConnectedNode.o: src/QSearchConnectedNode.cpp
	em++ -O3 -MMD -MP -std=c++20 src/QSearchConnectedNode.cpp -c -o web_build/QSearchConnectedNode.o

web_build/QSearchFullTree.o: src/QSearchFullTree.cpp
	em++ -O3 -MMD -MP -std=c++20 src/QSearchFullTree.cpp -c -o web_build/QSearchFullTree.o

web_build/QSearchMakeTree.o: src/QSearchMakeTree.cpp
	em++ -O3 -MMD -MP -std=c++20 src/QSearchMakeTree.cpp -c -o web_build/QSearchMakeTree.o

web_build/QSearchManager.o: src/QSearchManager.cpp
	em++ -O3 -MMD -MP -std=c++20 src/QSearchManager.cpp -c -o web_build/QSearchManager.o

web_build/QSearchNeighborList.o: src/QSearchNeighborList.cpp
	em++ -O3 -MMD -MP -std=c++20 src/QSearchNeighborList.cpp -c -o web_build/QSearchNeighborList.o

web_build/QSearchTree.o: src/QSearchTree.cpp
	em++ -O3 -MMD -MP -std=c++20 src/QSearchTree.cpp -c -o web_build/QSearchTree.o

web_build/SimpleMatrix.o: src/SimpleMatrix.cpp
	em++ -O3 -MMD -MP -std=c++20 src/SimpleMatrix.cpp -c -o web_build/SimpleMatrix.o

web_build/StringTools.o: src/StringTools.cpp
	em++ -O3 -MMD -MP -std=c++20 src/StringTools.cpp -c -o web_build/StringTools.o

# Create the web_build directory if it doesn't exist
web_build:
	@mkdir -p web_build
