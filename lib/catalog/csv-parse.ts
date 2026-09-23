// Minimal RFC-4180-subset CSV parser for the admin bulk importer.
// Hand-rolled on purpose: PapaParse is not in package.json and a small,
// fully-tested local parser avoids a new dependency for a bounded input
// (UTF-8 text, comma delimiter). Handles: quoted fields, "" escapes,
// commas/newlines inside quotes, CRLF/LF/CR endings, BOM, blank lines.
// Pure logic — no Supabase, no DOM — so it unit-tests without a database.

export interface CsvRecord {
  /** 1-based line number of the record's first line in the source text. */
  lineNumber: number;
  /** Raw cell values in column order (unescaped, untrimmed). */
  values: string[];
}

export interface ParsedCsv {
  headers: string[];
  records: CsvRecord[];
}

export function parseCsv(text: string): ParsedCsv {
  // Strip a UTF-8 BOM so the first header never carries an invisible char.
  const src = text.replace(/^\uFEFF/, "");
  const records: { values: string[]; lineNumber: number }[] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let rowStartLine = 1;
  let line = 1;
  let hasContent = false; // any char (or quote structure) seen for current row

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    records.push({ values: row, lineNumber: rowStartLine });
    row = [];
    hasContent = false;
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
          hasContent = true;
        } else {
          inQuotes = false;
          hasContent = true;
        }
      } else {
        if (c === "\n") line++;
        field += c;
        hasContent = true;
      }
      continue;
    }
    if (c === '"') {
      // An opening quote only counts at a field start; a stray quote
      // mid-field is kept literally so the row still parses.
      if (field === "") {
        inQuotes = true;
        hasContent = true;
      } else {
        field += c;
        hasContent = true;
      }
    } else if (c === ",") {
      pushField();
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      line++;
      if (row.length > 0 || hasContent) {
        pushRow();
      }
      rowStartLine = line;
    } else {
      field += c;
      hasContent = true;
    }
  }
  if (inQuotes) {
    throw new Error("Unterminated quoted field — check for an unclosed \" character.");
  }
  if (row.length > 0 || hasContent) {
    pushRow();
  }

  if (records.length === 0) {
    return { headers: [], records: [] };
  }
  const [{ values: headerRow }, ...dataRows] = records;
  const headers = headerRow.map((h) => h.trim());
  const out: CsvRecord[] = [];
  for (const r of dataRows) {
    // Skip blank lines: every cell empty/whitespace.
    if (r.values.every((v) => v.trim() === "")) continue;
    out.push({ lineNumber: r.lineNumber, values: r.values });
  }
  return { headers, records: out };
}
