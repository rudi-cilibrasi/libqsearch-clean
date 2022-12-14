#include "StringTools.hpp"

std::string remove_extension(const std::string& filename) {
    size_t lastdot = filename.find_last_of(".");
    if (lastdot == std::string::npos) return filename;
    return filename.substr(0, lastdot); 
}

void segment_string( StringList& v, const std::string& s, const char c )
{
    v.clear();
    std::istringstream sstream(s);
    for (std::string a; std::getline(sstream, a, c); ) {
        v.push_back(a);
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
    catch(std::exception& exc)  { 
                std::cout << "file write error\n";
        std::cout << "file read error\n";
        return false; 
    }
    return true;
}

bool write_whole_file( const std::string& s, const std::string& filename )
{
    try { 
        std::ofstream ofs(filename, std::ios_base::binary); 
        ofs << s; 
    }
    catch(std::exception& exc)  { 
        std::cout << "file write error\n";
        return false; 
    }
    return true;
}
