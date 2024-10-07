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

# General rule for compiling each .cpp file to .o with -O3 optimization
web_build/%.o: src/%.cpp | web_build
	em++ -O3 -MMD -MP -std=c++20 $< -c -o $@

# Create the web_build directory if it doesn't exist
web_build:
	@mkdir -p web_build
