export class UnionFind {
    private parents: number[];
    private rank: number[];
    private count: number;

    constructor(size: number) {
        this.parents = Array(size).fill(0).map((_, i) => i);
        this.rank = Array(size).fill(0);
        this.count = size;
    }

    // find root of the set with path compression
    find(x: number): number {
        if (this.parents[x] !== x) {
            this.parents[x] = this.find(this.parents[x]); // path compression
        }
        return this.parents[x];
    }

    // union 2 sets by rank
    union(x: number, y: number): boolean {
        const rootX = this.find(x);
        const rootY = this.find(y);

        if (rootX === rootY) return false;
        if (this.rank[rootX] < this.rank[rootY]) {
            this.parents[rootX] = rootY;
        } else if (this.rank[rootX] > this.rank[rootY]) {
            this.parents[rootY] = rootX;
        } else {
            this.parents[rootY] = rootX; // rootX now is the parent of rootY
            this.rank[rootX]++; // increase the rank for rootX
        }

        this.count--; // decrease number of sets
        return true;
    }

    connected(x: number, y: number): boolean {
        return this.find(x) === this.find(y);
    }

    getCount(): number {
        return this.count;
    }
}
