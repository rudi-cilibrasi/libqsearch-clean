#include "StringTools.hpp"

void segment_string( StringList& v, const std::string& s, const unsigned char c )
{
    unsigned int segment_begin = 0;
    unsigned int segment_end = 0;
    for( ; segment_end < s.length(); segment_end++ ) {
        if( (s[segment_end] == c) | (segment_end == s.length() - 1) ) {
            if( segment_end > segment_begin) {
                v.push_back( s.substr(segment_begin, segment_end-segment_begin) );
            }
            segment_begin = segment_end + 1;
        }
    }
}

void print_string_list( const StringList& v, const std::string spacer )
{
    for( auto& s : v ) std::cout << s << spacer;
}

bool read_whole_file( std::string& s, const std::string& filename )
{
    try {
        std::ifstream ifs(filename, std::ios_base::binary);
        std::ostringstream sstr;
        sstr << ifs.rdbuf();
        s = sstr.str();
    }
    catch(std::exception& exc)  { return false; }
    return true;
}

bool write_whole_file( const std::string& s, const std::string& filename )
{
    try { 
        std::ofstream ofs(filename, std::ios_base::binary); 
        ofs << s; 
    }
    catch(std::exception& exc)  { return false; }
    return true;
}
