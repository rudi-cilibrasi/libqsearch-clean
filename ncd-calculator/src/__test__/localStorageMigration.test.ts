import {beforeEach, expect, test} from "vitest";
import {LocalStorageKeyManager} from "../cache/LocalStorageKeyManager";

beforeEach(() => localStorage.clear());

test("cache migration preserves storage outside the CompLearn namespace", () => {
  localStorage.setItem("unrelated-auth-state", "keep-me");
  localStorage.setItem("fasta_accessionSequence:NC_1.1", "legacy");
  LocalStorageKeyManager.getInstance().clearAllCaches();

  expect(localStorage.getItem("unrelated-auth-state")).toBe("keep-me");
  expect(localStorage.getItem("fasta_accessionSequence:NC_1.1")).toBeNull();
});
