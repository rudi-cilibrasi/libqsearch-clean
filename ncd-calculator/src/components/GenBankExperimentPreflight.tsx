import {AlertCircle, CheckCircle2, Info} from "lucide-react";
import {analyzeGenBankExperiment} from "../services/genbankExperimentPreflight";
import type {SelectedItem} from "./workbenchTypes";

interface GenBankExperimentPreflightProps {
  readonly selectedItems: readonly SelectedItem[];
}

export const GenBankExperimentPreflight = ({selectedItems}: GenBankExperimentPreflightProps) => {
  const report = analyzeGenBankExperiment(selectedItems);
  if (report.recordCount === 0 && report.issues.length === 0) return null;
  return (
    <section className="genbank-preflight" aria-label="GenBank experiment preflight">
      <div className="genbank-preflight__heading">
        {report.canRun ? <CheckCircle2 size={17} aria-hidden="true"/> : <AlertCircle size={17} aria-hidden="true"/>}
        <strong>{report.canRun ? "GenBank set passes structural preflight" : "GenBank set needs attention"}</strong>
        <span>{report.recordCount} verified metadata {report.recordCount === 1 ? "record" : "records"}</span>
      </div>
      {report.issues.length > 0 && (
        <ul>
          {report.issues.map(issue => (
            <li key={`${issue.code}:${issue.message}`} data-severity={issue.severity}>
              <Info size={15} aria-hidden="true"/>
              <span>{issue.message}{issue.recordIds?.length ? ` (${issue.recordIds.join(", ")})` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
