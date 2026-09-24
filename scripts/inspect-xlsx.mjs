// Prints the structure of an Excel workbook: tabs, header rows, row counts,
// and cell comments. Reads only; changes nothing.
// Usage: node scripts/inspect-xlsx.mjs data/import/qa.xlsx
import ExcelJS from 'exceljs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/inspect-xlsx.mjs <file.xlsx>');
  process.exit(1);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);

const text = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.text) return String(v.text);
    if (v.result !== undefined) return text(v.result);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (v.hyperlink) return v.hyperlink;
  }
  return String(v);
};

for (const ws of wb.worksheets) {
  let rows = 0;
  const comments = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    rows++;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.note) {
        const note = typeof cell.note === 'string' ? cell.note : (cell.note.texts ?? []).map((t) => t.text).join('');
        comments.push({ cell: cell.address, note });
      }
    });
  });
  console.log(`\n=== Tab: "${ws.name}" — ${rows} non-empty rows, ${ws.columnCount} columns, ${comments.length} cell comments`);
  // First few rows, to find the header row.
  for (let r = 1; r <= Math.min(4, ws.rowCount); r++) {
    const vals = ws.getRow(r).values.slice(1).map(text).map((s) => s.slice(0, 28));
    if (vals.some(Boolean)) console.log(`  row ${r}: ${vals.map((v) => v || '·').join(' | ')}`);
  }
  for (const c of comments.slice(0, 3)) console.log(`  comment ${c.cell}: ${c.note.replace(/\s+/g, ' ').slice(0, 120)}`);
}
