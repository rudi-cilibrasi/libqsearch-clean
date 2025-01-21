export interface LabelMapping {
    id: string;
    displayLabel: string;
    originalLabel: string;
}

export class LabelManager {
    private static instance: LabelManager;
    private labelMappings: Map<string, LabelMapping>;

    private constructor() {
        this.labelMappings = new Map();
    }

    public static getInstance(): LabelManager {
        if (!LabelManager.instance) {
            LabelManager.instance = new LabelManager();
        }
        return LabelManager.instance;
    }

    public normalizeId(id: string): string {
        return id.replace(/\s+/g, "_").trim();
    }

    public registerLabel(originalLabel: string, displayLabel: string): string {
        const normalizedId = this.normalizeId(originalLabel);
        this.labelMappings.set(normalizedId, {
            id: normalizedId,
            displayLabel,
            originalLabel
        });
        return normalizedId;
    }

    public getDisplayLabel(id: string): string | undefined {
        const normalizedId = this.normalizeId(id);
        return this.labelMappings.get(normalizedId)?.displayLabel;
    }

    public hasDisplayLabel(id: string): boolean {
        return this.labelMappings.has(this.normalizeId(id));
    }

    public getLabelMapping(): Map<string, string> {
        const displayMap = new Map<string, string>();
        this.labelMappings.forEach((mapping, key) => {
            displayMap.set(key, mapping.displayLabel);
        });
        return displayMap;
    }

    public clear(): void {
        this.labelMappings.clear();
    }
}