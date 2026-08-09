import {useCallback, useEffect, useRef, useState} from "react";
import {AlertTriangle, ChevronRight, Dna} from "lucide-react";
import type {
  GenBankRecordSuggestion,
  GenBankSearchScope,
} from "@/services/genbank";
import {GenBankSearchService} from "@/services/GenBankSearchService";
import type {SelectedItem} from "./workbenchTypes";

interface FastaSearchSuggestionProps {
  readonly searchTerm: string;
  readonly scope: GenBankSearchScope;
  readonly addItem: (item: SelectedItem) => void;
  readonly genbankSearchService: GenBankSearchService;
  readonly selectedItems: readonly SelectedItem[];
}

const formatBases = (length: number): string => `${length.toLocaleString()} bp`;

const scopeLabel = (scope: GenBankRecordSuggestion["scope"]): string => {
  switch (scope) {
    case "mitochondrial-genome": return "mitochondrial genome";
    case "coi": return "COI / COX1";
    case "cytb": return "cytochrome b";
    default: return "scope not classified";
  }
};

export const FastaSearchSuggestion = ({
  searchTerm,
  scope,
  addItem,
  genbankSearchService,
  selectedItems,
}: FastaSearchSuggestionProps) => {
  const [records, setRecords] = useState<readonly GenBankRecordSuggestion[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);

  const requestPage = useCallback(async (requestedPage: number, append: boolean): Promise<void> => {
    const query = searchTerm.trim();
    if (query.length < 2) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await genbankSearchService.searchRecords({
        query,
        scope,
        page: requestedPage,
        pageSize: 5,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setRecords((current) => append
        ? [...current, ...result.records.filter(record => !current.some(item => item.accessionVersion === record.accessionVersion))]
        : result.records);
      setPage(result.page);
      setTotal(result.total);
      setHasMore(result.hasMore);
      setHasSearched(true);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setRecords([]);
      setHasMore(false);
      setHasSearched(true);
      setError(caught instanceof Error ? caught.message : "GenBank search failed.");
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, [genbankSearchService, scope, searchTerm]);

  useEffect(() => {
    activeRequest.current?.abort();
    setRecords([]);
    setPage(1);
    setTotal(0);
    setHasMore(false);
    setError(null);
    setHasSearched(false);
    if (searchTerm.trim().length < 2) return undefined;
    const timer = window.setTimeout(() => void requestPage(1, false), 300);
    return () => {
      window.clearTimeout(timer);
      activeRequest.current?.abort();
    };
  }, [requestPage, retryToken, scope, searchTerm]);

  const selectRecord = (record: GenBankRecordSuggestion): void => {
    const identity = record.variantName ? `${record.variantName} — ${record.organism}` : record.organism;
    addItem({
      type: "fasta",
      id: record.accessionVersion,
      label: `${identity} · ${record.accessionVersion}`,
      genBankCandidate: record,
    });
  };

  if (!searchTerm.trim()) return null;
  if (searchTerm.trim().length < 2) {
    return <div className="genbank-suggestions__status">Enter at least 2 characters.</div>;
  }
  if (error) {
    return (
      <div className="workbench-inline-error" role="alert">
        <span className="genbank-suggestions__error"><AlertTriangle size={17}/>{error}</span>
        <button type="button" onClick={() => setRetryToken(value => value + 1)}>Try again</button>
      </div>
    );
  }

  const selectedIds = new Set(selectedItems.map(item => item.id.toUpperCase()));
  const visibleRecords = records.filter(record => !selectedIds.has(record.accessionVersion));
  return (
    <div className="genbank-suggestions" aria-live="polite">
      {visibleRecords.map(record => (
        <button
          type="button"
          key={record.accessionVersion}
          className="genbank-suggestion"
          onClick={() => selectRecord(record)}
          aria-label={`Add ${record.organism}, ${record.accessionVersion}`}
        >
          <span className="genbank-suggestion__name">
            <Dna size={17} aria-hidden="true"/>
            <span>
              <strong>{record.variantName ?? record.organism}</strong>
              <small>{record.organism}</small>
            </span>
          </span>
          <span className="genbank-suggestion__record">
            <strong>{record.accessionVersion}</strong>
            <small>{formatBases(record.length)} · {scopeLabel(record.scope)} · {record.sourceDatabase}</small>
            <small title={record.title}>{record.title}</small>
          </span>
          <ChevronRight size={17} aria-hidden="true"/>
        </button>
      ))}
      {loading && <div className="genbank-suggestions__status" role="status">Loading GenBank records…</div>}
      {!loading && hasSearched && records.length === 0 && (
        <div className="genbank-suggestions__status">No records matched this animal and sequence scope.</div>
      )}
      {!loading && records.length > 0 && (
        <div className="genbank-suggestions__footer">
          <span>Showing {records.length.toLocaleString()} of {total.toLocaleString()}</span>
          {hasMore && <button type="button" onClick={() => void requestPage(page + 1, true)}>Load more</button>}
        </div>
      )}
    </div>
  );
};
