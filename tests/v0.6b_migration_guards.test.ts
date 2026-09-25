import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// GATE 034 guardrail: V0.6B server-side message validation must reject empty AND
// whitespace-only messages authoritatively in the database, not just in the UI.
// Catches a regression to the migration-021 defect where pg_catalog.btrim()
// (space-only trimming) let newline/tab-only messages through, and confirms the
// corrective migration 022 is present with the strict [^[:space:]] checks.
const repoRoot = path.resolve(import.meta.dirname, "..");

function readMigration(name: string): string {
  return fs.readFileSync(path.join(repoRoot, "supabase/migrations", name), "utf-8");
}

describe("GATE 034 — V0.6B server-side whitespace validation guard", () => {
  it("corrective migration 022 exists", () => {
    const m022 = readMigration("022_v0.6b_whitespace_validation_fix.sql");
    expect(m022).toContain("nonspace_check");
  });

  it("022 installs a strict non-whitespace CHECK on message_body", () => {
    const m022 = readMigration("022_v0.6b_whitespace_validation_fix.sql");
    expect(m022).toContain("quote_messages_message_body_nonspace_check");
    expect(m022).toContain("[^[:space:]]");
  });

  it("022 send RPCs use non-whitespace validation, not the btrim() defect", () => {
    const m022 = readMigration("022_v0.6b_whitespace_validation_fix.sql");
    expect(m022).not.toMatch(/btrim\(p_message/);
    const sendBlocks = m022.split("create or replace function");
    const sendRpc = sendBlocks.filter((b) => /send_quote_message|staff_send_quote_message/.test(b));
    expect(sendRpc.length).toBe(2);
    for (const block of sendRpc) {
      expect(block).toContain("p_message ~ '[^[:space:]]'");
    }
  });

  it("legacy whitespace-tolerant check is dropped before the strict check is added", () => {
    const m022 = readMigration("022_v0.6b_whitespace_validation_fix.sql");
    const dropIndex = m022.indexOf("drop constraint");
    const addIndex = m022.indexOf("add constraint quote_messages_message_body_nonspace_check");
    expect(dropIndex).toBeGreaterThan(-1);
    expect(addIndex).toBeGreaterThan(dropIndex);
  });

  it("migration 021 is superseded, not patched in place", () => {
    const m021 = readMigration("021_v0.6b_quote_conversation.sql");
    expect(m021).toMatch(/char_length\(pg_catalog\.btrim\(message_body\)\)/);
  });
});