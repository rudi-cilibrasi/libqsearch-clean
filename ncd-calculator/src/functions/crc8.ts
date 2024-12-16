export class CRC32Calculator {
    private static readonly table = CRC32Calculator.generateTable();

    private static generateTable(): Uint32Array {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let crc = i;
            for (let j = 0; j < 8; j++) {
                crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
            }
            table[i] = crc >>> 0;
        }
        return table;
    }

    public static calculate(data: Uint8Array): string {
        let crc = 0xFFFFFFFF;

        for (let i = 0; i < data.length; i++) {
            crc = (crc >>> 8) ^ this.table[(crc ^ data[i]) & 0xFF];
        }

        // Convert to hex and pad to 8 characters
        return (~crc >>> 0).toString(16).padStart(8, '0');
    }
}
