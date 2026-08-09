import React from "react";
import {Files, Info} from "lucide-react";
import {CompressionService} from "@/services/CompressionService";
import type {CompressionPreference} from "@/types/compression";

interface CompressorSelectorProps {
  readonly value: CompressionPreference;
  readonly onChange: (preference: CompressionPreference) => void;
}

const AUTO_DESCRIPTION =
  "Auto uses LZMA for ordered pairs up to 2 MiB, then Zstandard up to 128 MiB.";

export const CompressorSelector: React.FC<CompressorSelectorProps> = ({value, onChange}) => {
  const profile = value === "auto" ? undefined : CompressionService.getAlgorithmInfo(value);
  const description = profile?.description ?? AUTO_DESCRIPTION;

  return (
    <section className="compressor-selector" aria-labelledby="compressor-selector-title">
      <div className="compressor-selector__heading">
        <Files size={17} aria-hidden="true"/>
        <div>
          <h3 id="compressor-selector-title">Compressor model</h3>
          <p>NCD results are compressor-dependent. Keep this setting fixed when comparing runs.</p>
        </div>
      </div>
      <div className="compressor-selector__control">
        <label htmlFor="compression-algorithm">Compression algorithm</label>
        <select
          id="compression-algorithm"
          value={value}
          aria-describedby="compression-algorithm-description"
          onChange={(event) => onChange(event.target.value as CompressionPreference)}
        >
          <option value="auto">Auto-select (recommended)</option>
          {CompressionService.getAvailableAlgorithms().map((algorithm) => {
            const algorithmProfile = CompressionService.getAlgorithmInfo(algorithm);
            return (
              <option key={algorithm} value={algorithm}>
                {algorithmProfile.name}
              </option>
            );
          })}
        </select>
        <p id="compression-algorithm-description">
          <Info size={14} aria-hidden="true"/>
          <span>{description}</span>
        </p>
      </div>
    </section>
  );
};
