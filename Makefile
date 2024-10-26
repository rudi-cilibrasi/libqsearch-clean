EMCC = em++
EMCCFLAGS = --embed-file samples \
	-s NO_EXIT_RUNTIME=1 \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s MODULARIZE \
	-s SINGLE_FILE=1 \
	-s NO_DISABLE_EXCEPTION_CATCHING \
	-s EXPORT_ES6=1 \
	-lembind
SRC_DIR = src
BUILD_DIR_SINGLE_THREAD = qsearch_single_thread
BUILD_DIR_WORKER_DOM = qsearch_worker_DOM
BUILD_DIR_REACT_APP = qsearch_worker_react/src/wasm
TARGET_SINGLE_THREAD = $(BUILD_DIR_SINGLE_THREAD)/qsearch.js
TARGET_WORKER_DOM = $(BUILD_DIR_WORKER_DOM)/qsearch.js
TARGET_REACT_APP = $(BUILD_DIR_REACT_APP)/qsearch.js

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

all: $(TARGET_SINGLE_THREAD) $(TARGET_WORKER_DOM) $(TARGET_REACT_APP)

# Include dependency files
-include $(OBJ_FILES:.o=.d)

$(TARGET_SINGLE_THREAD): $(OBJ_FILES)
	@mkdir -p $(BUILD_DIR_SINGLE_THREAD)
	$(EMCC) $(EMCCFLAGS) -s ENVIRONMENT=web  $(OBJ_FILES) -o $(TARGET_SINGLE_THREAD)

$(TARGET_WORKER_DOM): $(OBJ_FILES)
	@mkdir -p $(BUILD_DIR_WORKER_DOM)
	$(EMCC) $(EMCCFLAGS) -s ENVIRONMENT=worker $(OBJ_FILES) -o $(TARGET_WORKER_DOM)

$(TARGET_REACT_APP): $(OBJ_FILES)
	@mkdir -p $(BUILD_DIR_REACT_APP)
	$(EMCC) $(EMCCFLAGS) -s ENVIRONMENT=worker $(OBJ_FILES) -o $(TARGET_REACT_APP)

# General rule for compiling each .cpp file to .o with -O3 optimization
web_build/%.o: src/%.cpp | web_build
	em++ -O3 -MMD -MP -std=c++20 $< -c -o $@

# Create the web_build directory if it doesn't exist
web_build:
	@mkdir -p web_build

clean:
	rm -rf web_build
	rm $(TARGET_SINGLE_THREAD)
	rm $(TARGET_WORKER_DOM)
	rm $(TARGET_REACT_APP)

.PHONY: all clean