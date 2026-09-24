# Data files

## `instructors.csv` — NEEDS INPUT

Placeholder for the Quality Analyst instructor master list. It is loaded into the
`instructors` table in Phase 4.

| Column      | Meaning                                                                 |
|-------------|-------------------------------------------------------------------------|
| `full_name` | The correct spelling, e.g. `Daniel Wolff`                               |
| `aliases`   | Other spellings seen in the sheets, separated by `;`, e.g. `Daniel Wolf` |

Example row:

```
Daniel Wolff,Daniel Wolf
```

## `import/`

Put the sheet exports (CSV) here for the Phase 4 import. This folder is
git-ignored because it contains customer data.
