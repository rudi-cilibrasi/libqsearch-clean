export class LabelSanitizer {
	private static labelMap: Map<string, string> = new Map<string, string>();
	private static reverseLabelMap: Map<string, string> = new Map<string, string>();
	
	
	public static setMappings(
		labelMap: Map<string, string>,
		reverseLabelMap: Map<string, string>
	) {
		this.labelMap = labelMap;
		this.reverseLabelMap = reverseLabelMap;
	}
	
	public static sanitizeLabel(label: string): string {
		return this.labelMap.get(label) || label;
	}
	
	public static restoreLabel(sanitizedLabel: string): string {
		return this.reverseLabelMap.get(sanitizedLabel) || sanitizedLabel;
	}
	
	public static clear(): void {
		this.labelMap.clear();
		this.reverseLabelMap.clear();
	}
}
