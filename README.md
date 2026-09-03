# SR University Timetable

This is an original beginner-friendly HTML, CSS, and JavaScript implementation of the SR University timetable workflow.

GitHub: https://github.com/bhuvanprakashchippa/Timetable-Comparator

## Run

The app uses a small local proxy because the source site requires a session cookie
and CSRF token, and browsers cannot call that site reliably from a static page.

1. Install Node.js 18 or newer.
2. Run `node server.js` from this folder.
3. Open `http://localhost:3000`.

Opening `index.html` directly or using Live Server will not provide the proxy.

## How the data works

The app uses the public SR University report endpoints:

- `get-yearbpublic?degree=...`
- `get-batchbpublic?year=...&degree=...`
- `searchBatchReport2Public`

It loads the complete available dataset dynamically for the selected degree, year, and batch through the local proxy. No database is needed, but the browser must be online and the source site must be available.

## Comparison algorithm

Each timetable row is normalized into a `day + time` key. For every selected batch, the app builds a map of occupied keys. A slot is a shared free period only when no selected member has that key. The room finder collects rooms from the selected data and removes rooms occupied at the chosen shared-free slot.
