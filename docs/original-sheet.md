# Original Google Sheet + Apps Script (source of truth for the port)

This documents the spreadsheet this project replaces, so the business rules
aren't lost. Source: `Arachim Clock in / out` Google Sheet (two tabs).

## Tab 1: "Clock in  out"

Data grows downward from **row 9** (rows 1–8 are headers/controls).

| Col | Header | Meaning |
| --- | --- | --- |
| A | Date | Shift date |
| B | Clock in | Time in (real time value) |
| C | Clock out | Time out (real time value) |
| D | Total Hours | `=if(C="",if(B="","","Clock out"),if(C-B<0,"Correct Clock in / out",C-B))` |
| E | Total Babysiter | `D + TIME(0,30,0)` when F is TRUE, else blank |
| F | Babysiter | TRUE/FALSE checkbox → triggers the +30 min |

### Reporting panels (columns H–L), duplicated for Work ($33) and Babysitter ($8)

1. **By month** — `I7 =SUMIFS(D:D, TEXT(A:A,"mmmm"), I6)`, `I9 =I7*24*I8`.
   ⚠️ Matches on month *name* only, so two different years with the same month
   would sum together. The port keys reports off real dates to avoid this.
2. **By date range** — `I13 =SUMIFS(D:D, A:A,">="&H12, A:A,"<="&I12)` (with an
   `"All"` shortcut and reversed-date guard), `I15 =I13*24*I14`.
3. **Update/Insert panel** (`H22:K22` = Row Number / Date / Clock in / Clock out)
   feeding the Apps Script buttons.

## Tab 2: "Invoice"

Billing template (FRY CAPITAL CORP.) that pulls live from tab 1:
`E13 ='Clock in  out'!I6` (month), `G19 ='Clock in  out'!I9` (monthly total $).
⚠️ Known bug: subtotal `G26 =sum(G19:G21)` omits line items G22:G25 — should be
`=sum(G19:G25)`.

## Apps Script (button handlers)

- `clockIn()` — inserts a row at A9, writes date + time; adds a blank separator
  row when a new ISO week starts (`isNewWeek` / `getWeekNumber`).
- `clockOut()` — writes the current time into C9.
- `rewriteRowData()` — overwrites A/B/C of a target row from the H23:K23 inputs.
- `insertNewRowFromInputs()` — inserts a new row at the target and fills A/B/C.

## How the port differs (deliberate improvements)

- Times stored as full **ISO timestamps** (UTC) — no midnight-crossing or
  text-vs-number ambiguity.
- Reports key off **real dates**, fixing the month-name-collision bug.
- Per-user, per-category **rates** instead of single cells.
- Multi-user ready (users + ownership) rather than one personal sheet.
- Offline-first desktop client with explicit sync, instead of a live-only sheet.
