# Weekflow Changelog

## v3.0 Quick Notes and Progress History — 2026-08-15

Added a fourth business page for reusable Quick Notes, deterministic local Task-draft conversion, and multi-entry Task progress history.

### Added and changed

- Added bilingual Quick Notes with editable titles, rich-text-only content, SharePoint/HTTP/HTTPS links, title/body search, latest-updated sorting, unsaved-change protection, and double-confirm deletion.
- Replaced arbitrary text/highlight color inputs in Quick Notes and Task progress history with two Excel-like 20-color preset palettes.
- Added one-time Note → progress conversion through Group → optional Flow → Task selection. The source Note remains, and a new independently timestamped progress entry is appended to the selected Task.
- Added deterministic Chinese/English local Task parsing without AI or network access. Explicit high-confidence fields prefill the existing Task form; fuzzy Group/Flow/person matches and relative or yearless dates remain visible suggestions for user confirmation.
- Split bare numbered lines (`1 / 2 / 3`, punctuation variants, and Chinese numerals) into separate Task candidates. Explicit weekly weekday and monthly day-of-month phrases now prefill recurrence plus next-week/next-month DDL and start date; users still confirm the recurrence end date.
- Treat each non-empty unlabeled line as a Task candidate while keeping labeled field lines attached to the preceding Task. Leading Chinese current/next/two-weeks-ahead weekday expressions, bare weekdays, numeric month-day forms, and year-qualified variants now prefill DDL and are removed from the Task name.
- Added sequential review for one or more candidate Tasks with source-note split view, detected/current count, Previous, Next, Skip, Save & Continue, and Complete Conversion.
- Added **+ Add Task Draft** so users can create missed candidates as a blank draft or from selected source text. Conversion cannot complete until every candidate is saved or skipped.
- Replaced the single Task progress box with a history manager. Every record has its own created/last-edited timestamps, rich formatting, source metadata, edit selection, new-record action, and double-confirm deletion; the latest record opens by default.
- Upgraded JSON data to v4 with `notes` and Task `progressEntries`. Existing v3 `progressNote` content migrates into one legacy history entry; JSON export and restore preserve all Notes, conversions, documents, history, and preferences.

### Excel and stability

- Kept the 20-column Task main import format and legacy single Progress Note compatibility. New current-data downloads add **Progress History**, one entry per row, while the main progress cell aggregates all entries newest-first with line breaks.
- Added the same Progress History worksheet to dashboard and Managed Person / Report To reports. Aggregate cells respect Excel's 32,767-character limit and point to the complete history when truncated.
- Kept reports free of frozen panes and validated all generated workbooks for Windows-safe OOXML: consistent three-sheet relationships/properties, standard AutoFilter metadata, `DocSecurity=0` where applicable, and no VBA, false macro markers, external links, connections, ActiveX, or OLE parts.
- Preserved Task completion and Group/Flow viewport anchoring in Task by Week and Task by Day, plus in-place Document Library checkbox updates, so earlier jump-to-top regressions do not return.
- Stabilized the English main navigation at desktop widths so all five page tabs stay on one line and retain identical geometry when switching between full and simplified headers.
- Fixed right-to-left whole-line and multi-line selections in Quick Notes and Task progress history so Bold, Italic, text color, highlight, and other formatting commands retain the intended selection.

## v2.6 Document Library Dual Layout — 2026-08-14

Added a Group layout for browsing documents by Task Group while preserving the existing List layout, data relations, imports, exports, and visual language.

### Added and changed

- Added List / Group layout switching in the Document Library. List retains the existing table and full filter behavior without functional changes.
- Added Group cards in a four-column default grid. Additional Groups wrap to later rows; every card has a fixed height and independent vertical scrolling.
- Group cards show document selection, document name, and a compact **Go to** link action. Clicking the name opens the existing edit dialog.
- Sorted each Group by open count across the current and previous natural week, descending, with document name as the tie-breaker.
- Added **Arrange Layout** to choose one to four Group columns per row and reorder Groups by drag-and-drop or move buttons. The button sits immediately to the left of the List / Group switch.
- Group mode keeps document-name search and Type filtering, while Group, Flow, Task, and Recently Used filters remain List-only.
- Stored layout mode, column count, and Group order inside the main JSON data preferences so export and restore preserve the user's layout.

### Compatibility and regression protection

- Kept the language switch immediately after Document Library on every main page; the library layout controls occupy a separate right-aligned area.
- Kept checkbox selection updates in place so selecting documents in long List or Group views does not reset the page or card scroll position.
- Did not change Task or Document Excel templates, upload schemas, dashboard reports, or person reports. All workbook paths continue to use the Windows-safe OOXML packaging and validation introduced earlier.

## v2.5 Bilingual Release — 2026-08-12

Complete bilingual language layer based on Weekflow v2.4. This release changes language and documentation only, while preserving the v2.4 business data structure and mechanisms.

### Added

- Added a Chinese / English switch immediately to the right of Document Library; English is the default and the selection is stored separately from business data.
- Translated navigation, Home, Task by Week, Task by Day, Overall Dashboard, Document Library, all forms and dialogs, filters, validation feedback, reminders, User Guide, and the full in-app Changelog.
- Made Task and Document blank templates, re-importable current Task data, Document Library downloads, dashboard reports, and per-person Task status reports follow the selected language.
- English workbooks use English sheet names, headers, instructions, labels, metadata, and filenames; imports continue to accept both English and Chinese headers and values.
- Added separate Chinese and English README pages with mutual language links and matching screenshots for each language.
- Rewrote release notes and automated regression documentation for the bilingual release.

### Compatibility and regression protection

- Fixed the English `This Week` badge so it no longer overlaps the week range or date at narrow week-column widths and Windows display scaling.
- Kept Windows-safe XLSX packaging, including `DocSecurity=0`, workbook properties, AutoFilter defined names, no VBA/external links/data connections, and no default frozen panes in dashboard/person reports.
- Kept Task completion viewport anchoring in Task by Week and Task by Day.
- Kept individual Group and Flow expand/collapse viewport anchoring.
- Kept individual document selection as an in-place update without table rebuild or scroll reset.
- Kept 1280 px Windows-width header actions at the far right and Document Library title/actions on one line.
- User-entered business content is never translated or rewritten.

## v2.4 Week / Day Timeline — 2026-08-10

- Renamed the main timeline Task by Week while retaining week navigation, this-week, full-range, filters, and expand/collapse controls.
- Added Task by Day by double-clicking a week header. It shows Monday through Sunday and only deadline occurrences inside that selected natural week.
- Recurring Tasks participate with their generated weekly/monthly occurrence, while other-week Tasks remain hidden.
- Preserved Group, Flow, Task, filters, edit, completion, and expand/collapse behavior in the daily view.
- Returning to Task by Week restores the prior weekly timeline position; entering from another main view starts in Task by Week.
- Moved the release to the isolated `weekflow-v2.4:*` storage namespace and retained earlier-version migration.
- Reused row anchoring in both timeline views so completion and hierarchy collapse do not jump to the first Group.
- Left existing Excel import/export formats and mechanisms unchanged.

## v2.3 Recurring Tasks and Deadline Reminder — 2026-08-08

- Added weekly and monthly recurring Tasks with required recurrence start/end dates; removed quarterly recurrence.
- Used the Task DDL as the weekday or day-of-month anchor and rendered every occurrence while storing/counting only one Task.
- Completing the current period completes that period and all earlier periods; the next period starts incomplete while history remains continuous.
- Expanded the Task template/current-data format from 16 to 20 columns with recurrence and completion history; retained legacy 16-column import.
- Added recurrence fields and status-aware timeline markers to dashboard and person reports.
- Added a non-blocking seven-day deadline reminder that closes after ten seconds.
- Removed the unused Flow-template feature while retaining Flow creation, editing, and Task ordering.
- Fixed Task completion jumping to the top and repaired legacy gapped recurrence histories.
- Fixed Windows scaling layouts so create actions stay at the right and Document Library actions remain aligned with the title.
- Removed false macro markers/code names from re-importable Task and Document Library workbooks and set document security to zero.

## v2.2 People Progress and Report Compatibility — 2026-08-08

- Kept five Overall Dashboard metrics permanently visible and opened one detail dimension at a time.
- Added Managed Person and Report To progress summaries with exact counts and completion rate.
- Added person-specific Task status exports sorted by Group with deadlines, progress, Deliverables, and related documents.
- Defined Report To and Managed Person as person-name fields throughout forms, documentation, and templates.
- Removed default frozen panes from dashboard and person reports.
- Retained Windows-required workbook properties and filter definitions without macros, external workbook links, or data connections.

## v2.1 Portable Data and Stable Long Lists — 2026-08-03

- Added current Task data download in the same structure as the Task import template.
- Added Supplement Import and double-confirm Complete Replacement for Task Excel uploads.
- Renamed the presentation export to Export Dashboard Report to distinguish it from re-importable data.
- Fixed Windows Excel repair prompts by adding the standard AutoFilter defined name, 1900 date system, workbook view, and application metadata.
- Confirmed reports contain no VBA, external workbook links, or data connections.
- Fixed individual Group/Flow expand/collapse jumping to the first Group.
- Fixed individual document selection rebuilding the table and jumping to the top.

## v2.0 Document Collaboration — 2026-07-31

- Added the Document Library alongside Timeline and Overall Dashboard.
- Added Documentation, Deliverable, Control Sheet, and Folder document types.
- Allowed one document to relate to multiple Tasks, Flows, and Groups, with two-way synchronization from the timeline.
- Added document search and Type, Task, Flow, and Group filters; Notes remain display-only for search.
- Added current/previous natural-week Recently Used filtering.
- Added manual entry, blank Excel template, Supplement Import, Overwrite All, and Document Library export.
- Added duplicate-URL replace/skip choices and double-confirm bulk deletion.
- Merged Task Documentation and Deliverable links into Related Documents.
- Added Group → Flow → Task cascading selection and unified high-contrast, auto-closing filter popovers.
- Moved Document search/filters above the table and removed duplicate top selection controls, Notes search, and action column.

## v1.1 Bulk Entry — 2026-07-30

- Added a blank Task Excel template, row validation preview, and bulk import.
- Added automatic Group/Flow reuse or creation and Flow step ordering.
- Made Urgency, Report To, and Deliverable required in both the web form and Excel import.
- Fixed text-formatted Excel dates being rejected as invalid.
- Migrated formal storage into the isolated `weekflow-v1.1:*` namespace.

## v1.0 First Release — 2026-07-30

- Added graphical Home, Timeline, Overall Dashboard, User Guide, and Changelog entries.
- Added `Group → optional Flow → ordered Task` organization.
- Added Flow creation, edit, deletion, collapse, progress, and Task step reordering.
- Added free-text Task progress notes and Documentation/Deliverable links.
- Added Group, Flow, status, urgency, overdue, and keyword filters.
- Added Overall Dashboard Task/Group/Flow summaries, JSON backup/restore, and Excel export.
- Released a clean build without sample data or a restore-sample-data action.
- Added reusable Report To / Managed Person history and Group-color inheritance for new Flows.
- Enlarged timeline left-column labels, compacted the header area, and strengthened data relationship validation.

Development collaboration attribution: Wesley Yan
