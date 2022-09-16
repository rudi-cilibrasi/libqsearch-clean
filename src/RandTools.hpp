#ifndef __RAND_TOOLS_HPP
#define __RAND_TOOLS_HPP
#include <random>

static std::random_device rd;    // non-deterministic generator
static std::mt19937 gen( rd() ); // start random engine
static std::uniform_real_distribution<float> rand1( 0.0f, 1.0f );
static std::uniform_int_distribution<unsigned int> random_bit( 0, 1 ); 
static float rand_range(const float a, const float b) { return a + ( b - a ) * rand1( gen ); }
// inclusive range - take care!
static int   rand_int(const float a, const float b) { std::uniform_int_distribution<int> r(a,b); return r(gen); }
static bool fair_coin() { return ( random_bit(gen) == 1 ); }

// potentially unfair coin - returns 1 with probability a
static unsigned int weighted_bit( const float a ) { if( rand1( gen ) < a ) return 1; else return 0; }

#endif // __RAND_TOOLS_HPP