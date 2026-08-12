# Weekflow Changelog

## v2.4 Bilingual Interface Update — 2026-08-12

Complete bilingual language layer based on Weekflow v2.4. This update changes language only and preserves the v2.4 business data structure and mechanisms.

### Added

- Added a Chinese / English switch immediately to the right of Document Library; English is the default and the selection is stored separately from business data.
- Translated navigation, Home, Task by Week, Task by Day, Overall Dashboard, Document Library, all forms and dialogs, filters, validation feedback, reminders, User Guide, and the full in-app Changelog.
- Made Task and Document blank templates, re-importable current Task data, Document Library downloads, dashboard reports, and per-person Task status reports follow the selected language.
- English workbooks use English sheet names, headers, instructions, labels, metadata, and filenames; imports continue to accept both English and Chinese headers and values.
- Rewrote README, release notes, and automated regression documentation for the bilingual release.

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
