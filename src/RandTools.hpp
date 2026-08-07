#ifndef __RAND_TOOLS_HPP
#define __RAND_TOOLS_HPP
#include <cstdint>
#include <random>

// One generator is shared across translation units. The previous header-local
// generators made it impossible for one seed to reproduce an entire search.
inline std::mt19937 gen{std::random_device{}()};
inline std::uniform_real_distribution<float> rand1( 0.0f, 1.0f );
inline std::uniform_int_distribution<unsigned int> random_bit( 0, 1 );
inline void seed_random(const std::uint32_t seed) { gen.seed(seed); }
inline float rand_range(const float a, const float b) { return a + ( b - a ) * rand1( gen ); }
// inclusive range - take care!
inline int rand_int(const int a, const int b) { std::uniform_int_distribution<int> r(a,b); return r(gen); }
inline unsigned int rand_int(const unsigned int a, const unsigned int b) { std::uniform_int_distribution<unsigned int> r(a,b); return r(gen); }
inline bool fair_coin() { return ( random_bit(gen) == 1 ); }

// potentially unfair coin - returns 1 with probability a
inline unsigned int weighted_bit( const float a ) { if( rand1( gen ) < a ) return 1; else return 0; }

#endif // __RAND_TOOLS_HPP
