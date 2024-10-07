#include "QSearchMakeTree.hpp"

int main(int argc, char **argv)
{
    QSearchMakeTree mt;
    std::string matstr;
    read_whole_file(matstr, "samples/SmallTest.txt");
    mt.make_tree(matstr);    
    read_whole_file(matstr, "samples/Mammals.txt");
    mt.make_tree(matstr);
    return 0;
}