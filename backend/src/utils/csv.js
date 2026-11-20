function escapeCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers, rows) {
  const head = headers.map((h) => escapeCell(h.label ?? h.key)).join(",");
  const body = rows.map((row) =>
    headers.map((h) => escapeCell(row[h.key])).join(",")
  );
  return [head, ...body].join("\r\n");
}

function sendCsv(res, filename, content) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename.replace(/"/g, "")}"`
  );
  // BOM keeps Excel happy with the ₹/Unicode-safe headers without changing values.
  res.send(`\uFEFF${content}`);
}

module.exports = { toCsv, sendCsv, escapeCell };
