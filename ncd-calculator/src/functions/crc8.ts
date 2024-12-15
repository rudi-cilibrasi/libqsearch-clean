export class CRC32Calculator {
    private static readonly table = CRC32Calculator.generateTable();

    /**
     * Generates CRC-32 lookup table using IEEE 802.3 polynomial (0xEDB88320)
     */
    private static generateTable(): Uint32Array {
        const table = new Uint32Array(256);

        for (let i = 0; i < 256; i++) {
            let crc = i;
            for (let j = 0; j < 8; j++) {
                crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
            }
            table[i] = crc >>> 0;  // Convert to unsigned 32-bit
        }

        return table;
    }

    /**
     * Calculates CRC-32 hash of input data
     * Returns CRC value as an unsigned 32-bit integer
     */
    public static calculate(data: Uint8Array): number {
        let crc = 0xFFFFFFFF;  // Initial value

        for (let i = 0; i < data.length; i++) {
            crc = (crc >>> 8) ^ this.table[(crc ^ data[i]) & 0xFF];
        }

        return (~crc >>> 0);  // Final XOR and convert to unsigned 32-bit
    }

    /**
     * Generates a cache key using the CRC-32 value
     * Returns string in format "compression:lzma:<crc32>"
     */
    public static generateKey(data: Uint8Array, algo: 'lzma' | 'gzip' = 'lzma'): string {
        const crc = this.calculate(data);
        return `compression:${algo}:${crc.toString(16).padStart(8, '0')}`;
    }
}
