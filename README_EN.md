<p align="right"><a href="README.md">中文</a> · <strong>English</strong></p>

# Weekflow v2.5 · Bilingual Task Management

Weekflow is a desktop-first, backend-free Multi-task management cockpit for tracking several workstreams and organizing all Task-related documents in one place. It combines weekly and daily deadline timelines, `Group → optional Flow → ordered Task` workflows, an Overall Dashboard, a unified Document Library, Excel bulk import/export, and local JSON backup.

The bilingual interface changes language only. It does not change the v2.4-compatible data model, business rules, recurrence logic, storage behavior, filtering, linking, or scrolling mechanisms.

## Quick Start

Keep the whole release folder together. Open a terminal in this folder and run:

```bash
npm run serve
```

Then open `http://localhost:8080/Weekflow.html`. You may also open `Weekflow.html` directly. `file://`, `http://localhost:8080`, another port, and another browser are different storage origins and may show different data.

## Language Switch

The `Chinese / EN` switch sits immediately to the right of **Document Library** in the main navigation. English is the default language. The selected language is stored separately under `weekflow-v2.4:language` and never rewrites user-entered Group, Flow, Task, document, person, Deliverable, progress, or note content.

The selected language applies to:

- Navigation, timeline, dashboards, Document Library, forms, filters, dialogs, validation feedback, reminders, User Guide, and Changelog.
- Blank Task and Document import templates.
- Re-importable current Task data and full Document Library downloads.
- Dashboard reports and Managed Person / Report To Task status reports.
- Workbook sheet names, headers, labels, metadata, and downloaded filenames.

Both English and Chinese import headers and supported field values remain accepted, so existing Chinese workbooks can still be uploaded in English mode.

## Key Features

### Home and Navigation

![Weekflow Home](readme-images-en/home.png)

- Home displays Task, Group, Flow, document, and completion-rate totals.
- Direct entries open Task by Week, Overall Dashboard, Document Library, User Guide, and Changelog.
- A non-blocking bottom-right reminder lists incomplete Tasks due within seven days and closes automatically after ten seconds.
- `Command/Ctrl + K` opens timeline search from Home or focuses document-name search in the Document Library.

### Task by Week and Task by Day

![Task by Week timeline](readme-images-en/task-by-week.png)

- Task by Week calculates natural weeks from Monday through Sunday; its header date is Friday.
- Browse earlier or later weeks, return to this week, or show the full Task range (up to 600 weeks).
- Double-click a week header to open Task by Day. The selected week is split into Monday through Sunday, and every deadline node lands on its exact date.
- Task by Day shows only Tasks with a deadline occurrence in the selected week, including generated weekly or monthly occurrences.
- Both views retain Group, Flow, Task, filtering, editing, completion, and expand/collapse behavior.
- Completing or reopening a Task preserves the operated Task row, horizontal position, and page position. Expanding or collapsing an individual Group or Flow preserves the operated hierarchy row.

### Groups, Flows, and Tasks

![Create a Task](readme-images-en/create-task.png)

- Tasks support create, edit, delete, complete/reopen, DDL, Urgency, Report To, Managed Person, Deliverable, progress notes, and related documents.
- Urgency, Report To, and Deliverable are required. Report To and Managed Person are person names, and previously used names become suggestions.
- Flow is an optional ordered layer between a Group and its Tasks. A new Flow inherits its Group color unless the user customizes it.
- Reorder Tasks inside a Flow by drag-and-drop or move controls.
- Weekly and monthly recurring Tasks require recurrence start and end dates. The form DDL is the weekday or day-of-month anchor.
- A recurring Task remains one stored and counted Task while rendering all scheduled deadlines. Completing the current natural week or month completes that occurrence and all earlier ones; the next period starts incomplete.

![Edit a Flow and reorder steps](readme-images-en/edit-flow.png)

### Related Documents and Document Library

![Document Library](readme-images-en/document-library.png)

- Documentation, Deliverables, Control Sheets, and Folders share one document record and can relate to multiple Tasks, Flows, and Groups.
- Editing from a Task or the Document Library updates the same data source.
- The library supports name search and Type, Group, Flow, and Task multi-select filters; Notes are displayed but are not searched.
- New or edited relations follow Group → Flow → Task cascading selection.
- Recently Used includes links opened at least once in the current or previous natural week.
- Select the current result set from the header checkbox. Individual checkbox changes update in place and do not rebuild or scroll the table to the top.
- Bulk deletion and overwrite-all import each require two confirmations.

### Overall Dashboard

![Overall Dashboard](readme-images-en/overall-dashboard.png)

- The five overview metrics—Total Tasks, Completed, Incomplete, Currently Overdue, and Completion Rate—are always visible.
- Open one detail dimension at a time: Group, Flow, Managed Person, or Report To.
- Person summaries show counts and completion rate and export that person's full Task status, sorted by Group.

![Export by Report To](readme-images-en/dashboard-report-to.png)

## Data Storage Location

Business data is stored in `localStorage` for the current browser and page origin under:

```text
weekflow-v2.4:data:v3
```

To avoid migrating or clearing existing user data during the v2.5 upgrade, Weekflow keeps the v2.4 storage namespace. This is a compatibility key and does not indicate that the application is still v2.4.

The top-level data structure is `version: 3` with `groups`, `flows`, `tasks`, and `materials`. Recurrence settings and occurrence completion history live on each Task, so recurring deadlines do not create duplicate Tasks. Weekflow can migrate same-origin v2.3, v2.2, v2.1, v2.0, v1.1, and v1.0 data while leaving older keys available for rollback.

Clearing site data, using a private window, changing browsers, or changing the launch origin changes which data is visible.

## Data Backup and Restore

Before bulk import, complete replacement, overwrite-all Document import, browser migration, or large deletion:

1. Open the `•••` data menu.
2. Select **Export JSON Backup**.
3. Store the `.json` file in a controlled location.

Use **Restore from JSON** to restore. Weekflow validates versions, unique IDs, dates, Group/Flow/Task relations, recurrence ranges and completion history, document types, URLs, relations, and open events before asking for confirmation. It attempts a `pre-import-backup` before replacement.

The JSON backup includes the complete data object, including documents that are not linked to a Task. For backward compatibility, these records remain stored under the internal `materials` property.

## Excel Bulk Import

### Task Import

Open `••• → Bulk Import`:

- **Download Excel Import Template** creates a blank 20-column workbook in the active language.
- **Download Current Data in Import Format** exports every current Task in the same structure for editing and re-upload.
- **Upload Excel for Bulk Import** validates a workbook, shows errors and a preview, then offers Supplement Import or double-confirm Complete Replacement.

Each row represents one Task. `Group*`, `Task Name*`, `DDL*`, `Urgency*`, `Report To*`, and `Deliverable*` are required. Flow is optional. Recurring Tasks require Recurrence Start and Recurrence End. `Recurrence Completion History` uses `occurrence DDL|completion date`, with periods separated by new lines or semicolons. One upload supports up to 1,000 Tasks.

Supplement Import keeps existing data and adds Tasks. Complete Replacement replaces all Groups, Flows, and Tasks but does not delete Document Library entries; matching hierarchy IDs are reused when possible to preserve relations. Legacy 16-column files remain accepted.

### Document Import

Use `Document Library → Download → Download Blank Template`, then upload from **Upload**.

- `Link Name*` and `Link URL*` are required.
- Type is Documentation, Deliverable, Control Sheet, or Folder; blank defaults to Documentation.
- Related Tasks, Flows, and Groups must already exist on the timeline. Use full paths such as `Group/Flow/Task` when names are ambiguous.
- Multiple relations use new lines or semicolons. A blank relation set is Ungrouped.
- Supplement Import can replace or skip duplicate URLs. Overwrite All removes the existing library after two confirmations and imports the workbook.
- One upload supports up to 2,000 documents.

## Excel Export

### Dashboard Report

**Export Dashboard Report** creates:

```text
Task_Dashboard_YYYYMMDD_HHmm.xlsx
```

The workbook contains:

1. `Overall Dashboard`: export time, overall metrics, Group summary, and Flow summary.
2. `Timeline Dashboard`: fixed Task fields, recurrence settings, progress, related documents, and the complete weekly deadline range.

The report always includes all Tasks regardless of timeline filters. It is a presentation workbook, not an import file; use **Download Current Data in Import Format** for re-import.

### Managed Person and Report To Reports

The corresponding Overall Dashboard dimensions export:

```text
Managed_Person_Name_Task_Status_YYYYMMDD_HHmm.xlsx
Report_To_Name_Task_Status_YYYYMMDD_HHmm.xlsx
```

Each workbook includes only the selected person’s Tasks, sorted by Group, with Flow/step, Task Name, people fields, Deliverable, DDL, recurrence, Urgency, completion, overdue state, progress notes, and related document names and URLs.

### Document Library

`Document Library → Download → Download Document Library` creates:

```text
Weekflow_Document_Library_YYYYMMDD_HHmm.xlsx
```

It includes Link Name, URL, Type, complete Task/Flow paths, Groups, and Notes. URLs remain clickable.

### Windows Excel Compatibility

Every generated `.xlsx` is repackaged through the same safety path. The package removes false macro markers and workbook code names, sets `DocSecurity=0`, and rejects VBA, external workbook links, data connections, ActiveX, and embedded OLE content. Dashboard and person reports include standard workbook views and AutoFilter defined names and do not open with frozen panes.

## Program Files

The entire folder is required; do not move only `Weekflow.html`. It depends on `css`, `js`, `vendor`, and the release files. The two legacy Chinese template files under `templates/` remain for offline compatibility, while UI template downloads are generated dynamically in the active language.

```text
Weekflow/
├── Weekflow.html
├── css/styles.css
├── js/i18n.js
├── js/app.js
├── js/automation.js
├── js/date-utils.js
├── js/excel-export.js
├── js/excel-import.js
├── js/material-excel.js
├── js/materials.js
├── js/stats.js
├── js/storage.js
├── js/xlsx-safe.js
├── js/utils.js
├── templates/
├── vendor/
├── tests/
├── CHANGELOG.md
├── RELEASE.txt
└── package.json
```

## Development Team

- Developer: Wesley Yan
- First release (v1.0): July 30, 2026
- Latest release (v2.5): August 12, 2026
- Bilingual interface release: August 12, 2026

## Security and Limits

- User content is rendered with DOM APIs rather than inserted as executable HTML.
- Links accept only `http:` and `https:` and open with `noopener,noreferrer`.
- Restore, import, and persistence paths validate structured data.
- Weekflow has no backend, account, cloud synchronization, or multi-user collaboration. SharePoint URLs are stored only as HTTPS links; the app does not call SharePoint APIs.
- The desktop UI is validated at 1280 px and wider; narrower screens retain horizontal scrolling where needed.

Development collaboration attribution: Wesley Yan
