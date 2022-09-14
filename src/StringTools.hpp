#ifndef __STRING_TOOLS_HPP
#define __STRING_TOOLS_HPP

#include <vector>
#include <string>
#include <iostream>
#include <fstream>
#include <sstream>

typedef std::vector<std::string> StringList;

// Breaks a string up into a vector of substrings wherever separated by a given character
void segment_string( StringList& v, const std::string& s, const char c );
void print_string_list( const StringList& v, const std::string spacer );
bool read_whole_file( std::string& s, const std::string& filename );
bool write_whole_file( const std::string& s, const std::string& filename );

#endif // __STRING_TOOLS_HPP