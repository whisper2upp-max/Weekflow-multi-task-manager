/* Weekflow 主应用：渲染、交互与 CRUD。 */
(function () {
  "use strict";

  var App = window.App;
  var i18n = App.i18n;
  var utils = App.utils;
  var dates = App.dateUtils;
  var stats = App.stats;
  var storage = App.storage;
  var excelExport = App.excelExport;
  var excelImport = App.excelImport;
  var materialTools = App.materials;
  var materialExcel = App.materialExcel;
  var automation = App.automation;
  var richText = App.richText;
  var taskDraftParser = App.taskDraftParser;
  var aiProvider = App.aiProvider;
  var RICH_TEXT_FONT_SIZES = [12, 14, 16, 18, 22];

  var urgencyLabels = i18n.urgencyLabels();
  var statusLabels = i18n.statusLabels();
  var MATERIAL_UNGROUPED_KEY = "__ungrouped__";
  var RICH_TEXT_COLOR_PALETTES = {
    text: [
      ["#172033", "墨黑", "Ink"],
      ["#475569", "石板灰", "Slate"],
      ["#64748B", "灰蓝", "Blue Gray"],
      ["#665CFF", "Weekflow 紫", "Weekflow Indigo"],
      ["#4338CA", "深靛蓝", "Deep Indigo"],
      ["#2563EB", "蓝色", "Blue"],
      ["#0E7490", "青蓝", "Cyan Blue"],
      ["#0F766E", "青绿", "Teal"],
      ["#15803D", "绿色", "Green"],
      ["#4D7C0F", "橄榄绿", "Olive"],
      ["#A16207", "赭黄", "Ochre"],
      ["#D97706", "橙色", "Orange"],
      ["#C2410C", "赤橙", "Burnt Orange"],
      ["#DC2626", "红色", "Red"],
      ["#BE123C", "玫红", "Rose"],
      ["#DB2777", "粉红", "Pink"],
      ["#9333EA", "紫色", "Purple"],
      ["#7C2D12", "棕色", "Brown"],
      ["#0F172A", "深蓝黑", "Navy Black"],
      ["#FFFFFF", "白色", "White"]
    ],
    highlight: [
      ["#FFF1A8", "浅黄", "Soft Yellow"],
      ["#FDE68A", "金黄", "Gold"],
      ["#FEF3C7", "浅琥珀", "Soft Amber"],
      ["#FED7AA", "浅橙", "Soft Orange"],
      ["#FECACA", "浅红", "Soft Red"],
      ["#FFE4E6", "浅玫红", "Soft Rose"],
      ["#FBCFE8", "浅粉", "Soft Pink"],
      ["#E9D5FF", "浅紫", "Soft Purple"],
      ["#DDD6FE", "浅靛蓝", "Soft Indigo"],
      ["#C7D2FE", "靛蓝灰", "Indigo Mist"],
      ["#BFDBFE", "浅蓝", "Soft Blue"],
      ["#BAE6FD", "天空蓝", "Sky Blue"],
      ["#A5F3FC", "浅青", "Soft Cyan"],
      ["#99F6E4", "浅青绿", "Soft Teal"],
      ["#BBF7D0", "浅绿", "Soft Green"],
      ["#D9F99D", "浅青柠", "Soft Lime"],
      ["#E2E8F0", "浅灰蓝", "Soft Slate"],
      ["#CBD5E1", "中性灰", "Neutral Gray"],
      ["#F1F5F9", "雾灰", "Mist"],
      ["#FFFFFF", "白色", "White"]
    ]
  };
  var data = storage.load();
  var ui = {
    view: "home",
    filters: {
      search: "",
      groupIds: [],
      flowId: "all",
      status: "all",
      urgency: "all",
      overdueOnly: false
    },
    timelineGranularity: "week",
    timelineMode: "window",
    timelineAnchor: dates.getWeekFriday(new Date()),
    timelineDayAnchor: dates.getWeekFriday(new Date()),
    weekTimelineViewport: null,
    windowPastWeeks: 4,
    windowFutureWeeks: 11,
    dashboardModule: null,
    taskDraftMaterials: [],
    taskDraftConversion: null,
    managedMaterials: [],
    managedTaskId: null,
    managedProgressTaskId: null,
    managedProgressEntryId: null,
    progressDraftEntry: null,
    progressDirty: false,
    selectedNoteId: null,
    noteSearch: "",
    noteScope: "all",
    noteDirty: false,
    noteIsNew: false,
    noteTableAnchorCell: null,
    noteTableFocusCell: null,
    noteTablePointerAnchorCell: null,
    noteTableDragSelecting: false,
    noteTableDragSelectionJustFinished: false,
    noteTableSuppressRangeSync: false,
    noteTableRangeSyncTimer: null,
    noteTableHoveredTable: null,
    noteTableHandleHideTimer: null,
    editingMaterialId: null,
    selectedMaterialIds: [],
    materialFilters: {
      name: "",
      types: [],
      taskIds: [],
      flowIds: [],
      groupIds: [],
      recentOnly: false
    },
    flowCreationForTask: false,
    flowColorCustomized: false,
    draggedFlowTaskId: null,
    draggedMaterialGroupKey: null,
    deletingGroupId: null,
    isSavingTask: false,
    isExporting: false,
    isExportingPersonStatus: false,
    isImportingExcel: false,
    pendingExcelImport: null,
    pendingMaterialImport: null,
    isImportingMaterials: false,
    ddlReminderTimer: null,
    recurrenceRefreshTimer: null,
    aiConverting: false,
    aiRewriting: false,
    aiTesting: false,
    aiOriginalHtml: null,
    aiRewriteOperation: null
  };

  var dom = {};

  function query(selector, root) {
    return (root || document).querySelector(selector);
  }

  function queryAll(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function confirmAction(message) {
    return window.confirm(i18n.translateMessage(message));
  }

  function cacheDom() {
    [
      "home-view",
      "timeline-view",
      "dashboard-view",
      "materials-view",
      "notes-view",
      "materials-layout-controls",
      "material-layout-settings-button",
      "filter-bar",
      "materials-filter-bar",
      "home-task-total",
      "home-completion-rate",
      "home-group-total",
      "home-flow-total",
      "home-material-total",
      "home-note-total",
      "filter-search",
      "filter-status",
      "filter-status-label",
      "filter-status-options",
      "filter-urgency",
      "filter-urgency-label",
      "filter-urgency-options",
      "filter-overdue",
      "group-filter",
      "group-filter-count",
      "group-filter-options",
      "filter-flow",
      "filter-flow-label",
      "filter-flow-options",
      "active-filters",
      "header-summary",
      "header-actions",
      "header-pending",
      "header-overdue",
      "timeline-heading",
      "timeline-subtitle",
      "timeline-current-label",
      "range-label",
      "timeline-week-range-controls",
      "timeline-week-return",
      "visible-result-count",
      "timeline-scroll",
      "timeline-board",
      "metric-cards",
      "group-dashboard",
      "flow-dashboard",
      "group-summary-body",
      "flow-summary-body",
      "dashboard-scope",
      "dashboard-module-nav",
      "dashboard-group-panel",
      "dashboard-flow-panel",
      "dashboard-managed-panel",
      "dashboard-report-panel",
      "managed-object-dashboard",
      "managed-object-summary-body",
      "report-to-dashboard",
      "report-to-summary-body",
      "materials-result-count",
      "materials-total",
      "materials-frequent-total",
      "materials-ungrouped-total",
      "materials-table-section",
      "materials-table-body",
      "materials-group-section",
      "materials-group-board",
      "notes-count",
      "note-filter-all",
      "note-filter-favorites",
      "note-all-count",
      "note-favorite-count",
      "note-search",
      "note-list",
      "note-editor-panel",
      "note-empty-state",
      "note-editor-shell",
      "note-title",
      "note-favorite-toggle",
      "note-save-state",
      "note-editor",
      "note-table-menu",
      "note-table-create-submenu",
      "note-table-edit-submenu",
      "note-table-size-grid",
      "note-table-size-label",
      "note-table-edit-help",
      "note-table-select-handle",
      "note-updated-at",
      "note-character-count",
      "note-conversion-summary",
      "note-delete-button",
      "note-save-button",
      "material-selection-count",
      "material-select-visible",
      "material-filter-name",
      "material-filter-types",
      "material-filter-tasks",
      "material-filter-flows",
      "material-filter-groups",
      "material-filter-type-label",
      "material-filter-task-label",
      "material-filter-flow-label",
      "material-filter-group-label",
      "material-type-filter",
      "material-group-filter",
      "material-flow-filter",
      "material-task-filter",
      "material-file-input",
      "group-dialog",
      "group-form",
      "group-dialog-title",
      "group-id",
      "group-name",
      "group-color",
      "group-color-value",
      "group-delete-button",
      "group-save-button",
      "flow-dialog",
      "flow-form",
      "flow-dialog-title",
      "flow-id",
      "flow-name",
      "flow-group",
      "flow-color",
      "flow-color-value",
      "flow-order-section",
      "flow-task-order-list",
      "flow-task-count",
      "flow-delete-button",
      "flow-save-button",
      "task-dialog",
      "task-form",
      "task-dialog-title",
      "task-dialog-cancel-button",
      "task-draft-source-pane",
      "task-draft-source-title",
      "task-draft-source-content",
      "task-draft-conversion-bar",
      "task-draft-position",
      "task-draft-status-summary",
      "task-draft-recognition",
      "task-draft-skip-button",
      "task-draft-complete-button",
      "task-id",
      "task-name",
      "task-group",
      "task-flow",
      "task-ddl",
      "task-recurrence",
      "task-recurrence-help",
      "task-recurrence-start-field",
      "task-recurrence-start",
      "task-recurrence-end-field",
      "task-recurrence-end",
      "task-urgency",
      "task-status",
      "task-status-help",
      "task-completed-at",
      "task-report-to",
      "task-report-to-options",
      "task-managed-object",
      "task-managed-object-options",
      "task-deliverable",
      "task-materials",
      "task-links-error",
      "task-delete-button",
      "task-save-button",
      "link-dialog",
      "link-form",
      "link-dialog-title",
      "link-dialog-task",
      "link-manager-rows",
      "link-manager-error",
      "link-manager-save",
      "material-dialog",
      "material-form",
      "material-dialog-title",
      "material-id",
      "material-title",
      "material-url",
      "material-type",
      "material-note",
      "material-task-options",
      "material-flow-options",
      "material-group-options",
      "material-delete-button",
      "material-save-button",
      "material-import-dialog",
      "material-import-file",
      "material-import-summary",
      "material-import-errors",
      "material-import-preview",
      "material-import-confirm",
      "material-duplicate-choice",
      "material-layout-dialog",
      "material-layout-form",
      "material-layout-columns",
      "material-layout-order-list",
      "progress-dialog",
      "progress-form",
      "progress-dialog-task",
      "progress-dialog-updated",
      "progress-note",
      "progress-entry-list",
      "progress-character-count",
      "progress-delete-button",
      "progress-save-button",
      "note-progress-dialog",
      "note-progress-form",
      "note-progress-context",
      "note-progress-group",
      "note-progress-flow",
      "note-progress-task",
      "note-progress-task-help",
      "note-progress-preview",
      "user-guide-dialog",
      "changelog-dialog",
      "delete-group-dialog",
      "delete-group-message",
      "delete-group-target",
      "excel-file-input",
      "excel-import-dialog",
      "excel-import-file",
      "excel-import-summary",
      "excel-import-errors",
      "excel-import-preview",
      "excel-import-confirm",
      "json-file-input",
      "ddl-reminder",
      "ddl-reminder-summary",
      "ddl-reminder-list",
      "ai-settings-dialog",
      "ai-settings-form",
      "ai-enabled",
      "ai-provider",
      "ai-api-key",
      "ai-base-url",
      "ai-model",
      "ai-model-custom",
      "ai-settings-status",
      "note-ai-enabled",
      "note-ai-rewrite-button",
      "note-ai-original-panel",
      "note-ai-original-content",
      "toast-region"
    ].forEach(function (id) {
      dom[id] = document.getElementById(id);
    });
  }

  function initialize() {
    cacheDom();
    updateAiUi();
    renderPresetColorPalettes();
    renderNoteTableSizePicker();
    bindEvents();
    syncLanguageAssets();
    var recurrenceSync = automation.syncRecurringTaskStates(data, new Date());
    if (recurrenceSync.changed) {
      try {
        data = storage.save(data);
      } catch (_error) {
        /* 后续正常渲染，并由保存流程报告具体存储问题。 */
      }
    }
    renderAll();
    i18n.applyDocument();
    var warning = storage.getLastWarning();
    if (warning) toast(warning, "warning", 7000);
    showDdlReminder();
    scheduleNextPeriodRefresh();
  }

  function bindEvents() {
    document.addEventListener("click", handleActionClick);
    document.addEventListener("click", closeOtherPopoverMenus);
    document.addEventListener("mousedown", preserveRichTextSelectionBeforeToolbarAction, true);
    document.addEventListener("keydown", handleKeyboard);
    window.addEventListener("beforeunload", function (event) {
      if (!ui.noteDirty && !ui.progressDirty && !ui.taskDraftConversion) return;
      event.preventDefault();
      event.returnValue = "";
    });
    queryAll("[data-language]").forEach(function (button) {
      button.addEventListener("click", function () {
        var nextLanguage = i18n.normalizeLanguage(button.dataset.language);
        if (nextLanguage === i18n.getLanguage()) return;
        if (
          ui.noteDirty &&
          !confirmAction("当前笔记尚未保存，切换语言会丢失这些修改。仍要继续吗？")
        ) {
          return;
        }
        if (
          ui.taskDraftConversion &&
          !confirmAction("Task 草稿转换尚未完成，切换语言会退出当前转换。仍要继续吗？")
        ) {
          return;
        }
        i18n.setLanguage(nextLanguage);
        window.location.reload();
      });
    });

    dom["filter-search"].addEventListener(
      "input",
      utils.debounce(function (event) {
        ui.filters.search = event.target.value.trim();
        renderFilteredViews();
      }, 120)
    );
    [
      dom["filter-flow-options"],
      dom["filter-status-options"],
      dom["filter-urgency-options"]
    ].forEach(function (container) {
      container.addEventListener("change", handleTimelineSingleFilterChange);
    });
    dom["filter-overdue"].addEventListener("change", function (event) {
      ui.filters.overdueOnly = event.target.checked;
      renderFilteredViews();
    });
    dom["group-filter-options"].addEventListener("change", function (event) {
      if (!event.target.matches("[data-group-filter]")) return;
      ui.filters.groupIds = queryAll("[data-group-filter]:checked", dom["group-filter-options"]).map(
        function (input) {
          return input.value;
        }
      );
      var selectedFlow = getFlow(ui.filters.flowId);
      if (
        selectedFlow &&
        ui.filters.groupIds.length &&
        !ui.filters.groupIds.includes(selectedFlow.groupId)
      ) {
        ui.filters.flowId = "all";
      }
      renderFilteredViews();
    });
    dom["group-form"].addEventListener("submit", saveGroupFromForm);
    dom["group-color"].addEventListener("input", function () {
      dom["group-color-value"].textContent = dom["group-color"].value.toUpperCase();
    });
    dom["flow-form"].addEventListener("submit", saveFlowFromForm);
    dom["flow-group"].addEventListener("change", syncFlowColorWithSelectedGroup);
    dom["flow-color"].addEventListener("input", function () {
      ui.flowColorCustomized = true;
      dom["flow-color-value"].textContent = dom["flow-color"].value.toUpperCase();
    });
    dom["task-form"].addEventListener("submit", saveTaskFromForm);
    dom["task-group"].addEventListener("change", function () {
      populateTaskFlowSelect(dom["task-group"].value, null);
    });
    dom["task-flow"].addEventListener("change", handleTaskFlowSelection);
    dom["task-recurrence"].addEventListener("change", syncTaskRecurrenceFields);
    dom["task-status"].addEventListener("change", syncCompletedDate);
    dom["link-form"].addEventListener("submit", saveManagedLinks);
    dom["progress-form"].addEventListener("submit", saveProgressEntry);
    dom["progress-note"].addEventListener("input", function () {
      ui.progressDirty = true;
      updateProgressCharacterCount();
    });
    dom["progress-note"].addEventListener("paste", handleRichTextPaste);
    dom["progress-note"].addEventListener("mouseup", rememberRichTextSelection);
    dom["progress-note"].addEventListener("keyup", rememberRichTextSelection);
    dom["note-progress-form"].addEventListener("submit", convertNoteToProgress);
    dom["note-progress-group"].addEventListener("change", populateNoteProgressRelations);
    dom["note-progress-flow"].addEventListener("change", populateNoteProgressTasks);
    dom["note-search"].addEventListener(
      "input",
      utils.debounce(function (event) {
        ui.noteSearch = event.target.value.trim();
        renderNoteList();
      }, 100)
    );
    [dom["note-title"], dom["note-editor"]].forEach(function (field) {
      field.addEventListener("input", markNoteDirty);
    });
    dom["note-editor"].addEventListener("paste", handleRichTextPaste);
    dom["note-editor"].addEventListener("copy", handleNoteTableCopy);
    dom["note-editor"].addEventListener("mousedown", handleNoteEditorTableMouseDown);
    dom["note-editor"].addEventListener("mousemove", handleNoteEditorTableMouseMove);
    dom["note-editor"].addEventListener("mouseup", handleNoteEditorTableMouseUp);
    dom["note-editor"].addEventListener("click", handleNoteEditorTableClick);
    dom["note-editor"].addEventListener("mouseup", rememberRichTextSelection);
    dom["note-editor"].addEventListener("keyup", rememberRichTextSelection);
    dom["note-editor"].addEventListener("mouseleave", scheduleNoteTableHandleHide);
    dom["note-editor"].addEventListener("scroll", refreshNoteTableSelectHandle);
    dom["note-table-select-handle"].addEventListener("mouseenter", cancelNoteTableHandleHide);
    dom["note-table-select-handle"].addEventListener("mouseleave", scheduleNoteTableHandleHide);
    dom["note-table-menu"].addEventListener("mouseover", handleNoteTableSubmenuIntent);
    dom["note-table-menu"].addEventListener("focusin", handleNoteTableSubmenuIntent);
    window.addEventListener("resize", refreshNoteTableSelectHandle);
    dom["task-dialog"].addEventListener("cancel", handleTaskDialogCancel);
    dom["ai-settings-form"].addEventListener("submit", saveAiSettings);
    dom["ai-provider"].addEventListener("change", handleAiProviderChange);
    dom["ai-model"].addEventListener("change", handleAiModelChange);
    dom["note-ai-enabled"].addEventListener("change", handleNoteAiToggle);
    queryAll("[data-font-size]").forEach(function (control) {
      control.addEventListener("change", function () {
        applyPresetFontSize(control);
      });
    });
    dom["progress-dialog"].addEventListener("cancel", handleProgressDialogCancel);
    dom["excel-file-input"].addEventListener("change", importExcelFile);
    queryAll('input[name="excel-import-mode"]').forEach(function (input) {
      input.addEventListener("change", renderExcelImportMode);
    });
    dom["json-file-input"].addEventListener("change", importJsonFile);
    dom["material-form"].addEventListener("submit", saveMaterialFromForm);
    dom["material-form"].addEventListener("input", handleMaterialRelationSearch);
    dom["material-form"].addEventListener("change", handleMaterialRelationChange);
    dom["material-file-input"].addEventListener("change", importMaterialFile);
    dom["material-select-visible"].addEventListener("change", function (event) {
      setVisibleMaterialsSelected(event.target.checked);
    });
    dom["materials-table-body"].addEventListener("change", handleMaterialSelectionChange);
    dom["materials-group-board"].addEventListener("change", handleMaterialSelectionChange);
    dom["material-layout-form"].addEventListener("submit", saveMaterialLayoutPreferences);
    queryAll('input[name="material-import-mode"]').forEach(function (input) {
      input.addEventListener("change", renderMaterialImportMode);
    });
    dom["material-filter-name"].addEventListener(
      "input",
      utils.debounce(function (event) {
        ui.materialFilters.name = event.target.value.trim();
        renderMaterialLibrary();
      }, 120)
    );
    [
      ["material-filter-types", "types", "materialFilterType"],
      ["material-filter-tasks", "taskIds", "materialFilterTask"],
      ["material-filter-flows", "flowIds", "materialFilterFlow"],
      ["material-filter-groups", "groupIds", "materialFilterGroup"]
    ].forEach(function (config) {
      dom[config[0]].addEventListener("change", function () {
        ui.materialFilters[config[1]] = queryAll(
          '[data-' +
            config[2].replace(/[A-Z]/g, function (letter) {
              return "-" + letter.toLowerCase();
            }) +
            "]:checked",
          dom[config[0]]
        ).map(function (input) {
          return input.value;
        });
        renderMaterialLibrary();
      });
    });
  }

  function syncLanguageAssets() {
    queryAll("[data-template-kind]").forEach(function (link) {
      link.removeAttribute("href");
      link.addEventListener("click", function (event) {
        event.preventDefault();
        downloadBlankTemplate(link.dataset.templateKind);
      });
    });
    urgencyLabels = i18n.urgencyLabels();
    statusLabels = i18n.statusLabels();
  }

  function downloadBlankTemplate(kind) {
    if (kind === "task") {
      excelImport
        .exportTemplateWorkbook(
          window.JSZip,
          i18n.isEnglish()
            ? "Weekflow_Task_Import_Template_EN.xlsx"
            : "Weekflow_Task导入模板.xlsx"
        )
        .then(function (result) {
          utils.downloadBlob(result.blob, result.filename);
          toast(i18n.isEnglish() ? "Blank Task template downloaded." : "Task 空白模板已下载");
        })
        .catch(function (error) {
          toast((i18n.isEnglish() ? "Template download failed: " : "模板下载失败：") + error.message, "error", 7000);
        });
      return;
    }
    if (kind === "materials") {
      materialExcel
        .exportTemplateWorkbook(
          window.JSZip,
          i18n.isEnglish()
            ? "Weekflow_Document_Import_Template_EN.xlsx"
            : "Weekflow_资料库导入模板.xlsx"
        )
        .then(function (result) {
          utils.downloadBlob(result.blob, result.filename);
          toast(i18n.isEnglish() ? "Blank document template downloaded." : "资料库空白模板已下载");
        })
        .catch(function (error) {
          toast((i18n.isEnglish() ? "Template download failed: " : "模板下载失败：") + error.message, "error", 7000);
        });
    }
  }

  function handleKeyboard(event) {
    if (event.key === "Escape") {
      closePresetColorPalettes();
      closeNoteTableMenu();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (ui.view === "home" || ui.view === "dashboard") switchView("timeline");
      requestAnimationFrame(function () {
        var search =
          ui.view === "materials"
            ? dom["material-filter-name"]
            : ui.view === "notes"
              ? dom["note-search"]
              : dom["filter-search"];
        search.focus();
        search.select();
      });
    }
  }

  function handleTimelineSingleFilterChange(event) {
    var kind = event.target.dataset.timelineFilter;
    if (!kind || !event.target.checked) return;
    var value = event.target.value;
    if (kind === "flowId") {
      ui.filters.flowId = value;
      var flow = getFlow(value);
      if (
        flow &&
        ui.filters.groupIds.length &&
        !ui.filters.groupIds.includes(flow.groupId)
      ) {
        ui.filters.groupIds = [flow.groupId];
      }
    } else if (kind === "status") {
      ui.filters.status = value;
    } else if (kind === "urgency") {
      ui.filters.urgency = value;
    }
    renderFilteredViews();
    closeDetailsMenus();
  }

  function closeOtherPopoverMenus(event) {
    var activeMenu = event.target.closest(
      ".filter-menu, .more-menu, .materials-download-menu"
    );
    queryAll(
      ".filter-menu[open], .more-menu[open], .materials-download-menu[open]"
    ).forEach(function (details) {
      if (details !== activeMenu) details.open = false;
    });
    closePresetColorPalettes(event.target.closest("[data-color-picker]"));
    closeNoteTableMenu(event.target.closest("[data-table-tool]"));
  }

  function handleActionClick(event) {
    if (event.target.closest(".materials-download-popover a")) {
      window.setTimeout(closeDetailsMenus, 0);
    }

    var viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      if (
        viewButton.dataset.view === "timeline" &&
        ui.view === "timeline" &&
        ui.timelineGranularity === "day"
      ) {
        returnToWeekTimeline();
        return;
      }
      switchView(viewButton.dataset.view);
      return;
    }

    var addMaterialButton = event.target.closest("[data-add-material]");
    if (addMaterialButton) {
      addDraftMaterial();
      return;
    }

    var actionNode = event.target.closest("[data-action]");
    if (!actionNode) return;
    var action = actionNode.dataset.action;
    var actions = {
      "show-home": function () {
        event.preventDefault();
        switchView("home");
      },
      "open-user-guide": function () {
        dom["user-guide-dialog"].showModal();
      },
      "close-user-guide": function () {
        dom["user-guide-dialog"].close();
      },
      "open-changelog": function () {
        dom["changelog-dialog"].showModal();
      },
      "close-changelog": function () {
        dom["changelog-dialog"].close();
      },
      "open-ai-settings": openAiSettingsDialog,
      "close-ai-settings": closeAiSettingsDialog,
      "test-ai-connection": testAiConnection,
      "clear-ai-settings": clearAiSettings,
      "new-group": openNewGroup,
      "new-flow": function () {
        openNewFlow();
      },
      "new-task": openNewTask,
      "new-note": openNewNote,
      "save-note": function () {
        saveCurrentNote(false);
      },
      "delete-note": deleteCurrentNote,
      "edit-note": function () {
        selectNote(actionNode.dataset.noteId);
      },
      "filter-notes": function () {
        setNoteScope(actionNode.dataset.noteScope);
      },
      "toggle-note-favorite": function () {
        toggleNoteFavorite(actionNode.dataset.noteId || ui.selectedNoteId);
      },
      "note-to-progress": openNoteProgressDialog,
      "close-note-progress": function () {
        dom["note-progress-dialog"].close();
      },
      "note-ai-rewrite": aiRewriteCurrentNote,
      "close-ai-original": closeAiOriginalPanel,
      "restore-ai-original": restoreAiOriginal,
      "note-to-task-drafts": startNoteTaskConversion,
      "rich-command": function () {
        executeRichTextCommand(
          actionNode.dataset.command,
          null,
          dom[actionNode.dataset.editor]
        );
      },
      "toggle-color-palette": function () {
        togglePresetColorPalette(actionNode);
      },
      "apply-preset-color": function () {
        applyPresetColor(actionNode);
      },
      "toggle-note-table-menu": function () {
        toggleNoteTableMenu(actionNode);
      },
      "open-note-table-submenu": function () {
        openNoteTableSubmenu(actionNode.dataset.tableSubmenuTarget, actionNode);
      },
      "insert-note-table": function () {
        insertNoteTable(Number(actionNode.dataset.rows), Number(actionNode.dataset.columns));
      },
      "edit-note-table": function () {
        editNoteTable(actionNode.dataset.tableOperation);
      },
      "select-whole-note-table": selectWholeHoveredNoteTable,
      "new-material": function () {
        openMaterialDialog();
      },
      "close-group-dialog": function () {
        dom["group-dialog"].close();
      },
      "close-task-dialog": function () {
        requestCloseTaskDialog();
      },
      "close-flow-dialog": closeFlowDialog,
      "close-link-dialog": function () {
        dom["link-dialog"].close();
      },
      "close-material-dialog": function () {
        dom["material-dialog"].close();
      },
      "close-progress-dialog": function () {
        requestCloseProgressDialog();
      },
      "new-progress-entry": newProgressEntry,
      "select-progress-entry": function () {
        selectProgressEntry(actionNode.dataset.progressEntryId);
      },
      "delete-progress-entry": deleteProgressEntry,
      "task-draft-previous": function () {
        moveTaskDraftCandidate(-1);
      },
      "task-draft-next": function () {
        moveTaskDraftCandidate(1);
      },
      "task-draft-add": addTaskDraftCandidate,
      "task-draft-skip": skipTaskDraftCandidate,
      "task-draft-complete": completeTaskDraftConversion,
      "close-ddl-reminder": closeDdlReminder,
      "delete-group": requestDeleteCurrentGroup,
      "delete-flow": requestDeleteCurrentFlow,
      "delete-task": requestDeleteCurrentTask,
      "timeline-prev": function () {
        shiftTimeline(-4);
      },
      "timeline-next": function () {
        shiftTimeline(4);
      },
      "timeline-today": returnToCurrentWeek,
      "timeline-all": showAllTaskRange,
      "timeline-week-return": returnToWeekTimeline,
      "groups-expand-all": function () {
        setAllGroupsCollapsed(false);
      },
      "groups-collapse-all": function () {
        setAllGroupsCollapsed(true);
      },
      "clear-groups": function () {
        ui.filters.groupIds = [];
        renderFilteredViews();
      },
      "clear-flow-filter": function () {
        ui.filters.flowId = "all";
        renderFilteredViews();
      },
      "clear-status-filter": function () {
        ui.filters.status = "all";
        renderFilteredViews();
      },
      "clear-urgency-filter": function () {
        ui.filters.urgency = "all";
        renderFilteredViews();
      },
      "clear-filters": clearFilters,
      "clear-material-types": function () {
        clearMaterialFilter("types");
      },
      "clear-material-groups": function () {
        clearMaterialFilter("groupIds");
      },
      "clear-material-flows": function () {
        clearMaterialFilter("flowIds");
      },
      "clear-material-tasks": function () {
        clearMaterialFilter("taskIds");
      },
      "clear-material-filters": clearMaterialFilters,
      "toggle-dashboard-module": function () {
        toggleDashboardModule(actionNode.dataset.dashboardModule);
      },
      "export-person-task-status": function () {
        exportPersonTaskStatus(actionNode);
      },
      "export-excel": function () {
        exportExcel(actionNode);
      },
      "export-import-data": exportTaskImportData,
      "import-excel": openExcelFilePicker,
      "choose-excel-import": openExcelFilePicker,
      "close-excel-import": closeExcelImportDialog,
      "confirm-excel-import": confirmExcelImport,
      "export-json": exportJsonBackup,
      "import-json": function () {
        closeDetailsMenus();
        dom["json-file-input"].click();
      },
      "add-managed-link": addManagedLink,
      "delete-material": deleteCurrentMaterial,
      "delete-selected-materials": deleteSelectedMaterials,
      "materials-all": function () {
        ui.materialFilters.recentOnly = false;
        renderMaterialLibrary();
      },
      "materials-recent": function () {
        ui.materialFilters.recentOnly = true;
        renderMaterialLibrary();
      },
      "materials-layout-list": function () {
        setMaterialLibraryLayout("list");
      },
      "materials-layout-group": function () {
        setMaterialLibraryLayout("group");
      },
      "open-material-layout-settings": openMaterialLayoutSettings,
      "close-material-layout-settings": closeMaterialLayoutSettings,
      "reset-material-layout": resetMaterialLayoutDraft,
      "import-materials": openMaterialFilePicker,
      "choose-material-import": openMaterialFilePicker,
      "close-material-import": closeMaterialImportDialog,
      "confirm-material-import": confirmMaterialImport,
      "export-materials": exportMaterialLibrary,
      "cancel-group-delete": cancelGroupDelete,
      "move-and-delete-group": moveTasksAndDeleteGroup,
      "delete-group-with-tasks": deleteGroupWithTasks
    };
    if (actions[action]) actions[action]();
  }

  function persistAndRender(message) {
    try {
      automation.syncRecurringTaskStates(data, new Date());
      data = storage.save(data);
      sanitizeUiState();
      renderAll();
      if (message) toast(message);
      var warning = storage.getLastWarning();
      if (warning) toast(warning, "warning", 6500);
      return true;
    } catch (error) {
      toast("保存失败：" + error.message, "error", 6500);
      return false;
    }
  }

  function findTimelineAnchorRow(kind, id) {
    var selectors = { group: ".group-row", flow: ".flow-row", task: ".task-row" };
    var datasetKeys = { group: "groupId", flow: "flowId", task: "taskId" };
    var selector = selectors[kind];
    var datasetKey = datasetKeys[kind];
    if (!selector || !datasetKey) return null;
    return queryAll(selector, dom["timeline-board"]).find(function (row) {
      return row.dataset[datasetKey] === id;
    });
  }

  function captureTimelineViewport(kind, id) {
    var scroller = dom["timeline-scroll"];
    var anchor = findTimelineAnchorRow(kind, id);
    return {
      kind: kind,
      id: id,
      scrollTop: scroller.scrollTop,
      scrollLeft: scroller.scrollLeft,
      windowX: window.scrollX,
      windowY: window.scrollY,
      anchorTop: anchor
        ? anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top
        : null
    };
  }

  function restoreTimelineViewport(viewport) {
    if (!viewport) return;
    var scroller = dom["timeline-scroll"];
    function restore() {
      scroller.scrollLeft = viewport.scrollLeft;
      var anchor = findTimelineAnchorRow(viewport.kind, viewport.id);
      if (anchor && Number.isFinite(viewport.anchorTop)) {
        var currentTop =
          anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        scroller.scrollTop += currentTop - viewport.anchorTop;
      } else {
        scroller.scrollTop = viewport.scrollTop;
      }
      window.scrollTo(viewport.windowX, viewport.windowY);
    }
    restore();
    window.requestAnimationFrame(restore);
  }

  function persistAndRenderTimelineCollapse(kind, id) {
    return persistAndRenderTimelineAction(kind, id);
  }

  function persistAndRenderTimelineAction(kind, id, message) {
    var viewport = captureTimelineViewport(kind, id);
    var saved = persistAndRender(message);
    restoreTimelineViewport(viewport);
    return saved;
  }

  function sanitizeUiState() {
    var validGroupIds = new Set(
      data.groups.map(function (group) {
        return group.id;
      })
    );
    ui.filters.groupIds = ui.filters.groupIds.filter(function (id) {
      return validGroupIds.has(id);
    });
    if (
      ui.filters.flowId !== "all" &&
      ui.filters.flowId !== "none" &&
      !getFlow(ui.filters.flowId)
    ) {
      ui.filters.flowId = "all";
    }
    var validTaskIds = new Set(
      data.tasks.map(function (task) {
        return task.id;
      })
    );
    var validFlowIds = new Set(
      data.flows.map(function (flow) {
        return flow.id;
      })
    );
    ui.materialFilters.taskIds = ui.materialFilters.taskIds.filter(function (id) {
      return validTaskIds.has(id);
    });
    ui.materialFilters.flowIds = ui.materialFilters.flowIds.filter(function (id) {
      return validFlowIds.has(id);
    });
    ui.materialFilters.groupIds = ui.materialFilters.groupIds.filter(function (id) {
      return id === "__ungrouped__" || validGroupIds.has(id);
    });
    ui.materialFilters.types = ui.materialFilters.types.filter(function (type) {
      return materialTools.TYPES.includes(type);
    });
    var validMaterialIds = new Set(
      data.materials.map(function (material) {
        return material.id;
      })
    );
    ui.selectedMaterialIds = ui.selectedMaterialIds.filter(function (id) {
      return validMaterialIds.has(id);
    });
    if (
      ui.selectedNoteId &&
      !data.notes.some(function (note) {
        return note.id === ui.selectedNoteId;
      })
    ) {
      ui.selectedNoteId = null;
      ui.noteDirty = false;
      ui.noteIsNew = false;
    }
  }

  function renderAll() {
    sanitizeUiState();
    renderHeaderSummary();
    renderHomeSummary();
    renderTaskSuggestionOptions();
    renderFilterControls();
    renderTimeline();
    renderDashboard();
    renderMaterialLibrary();
    renderNotes();
    syncView();
  }

  function renderFilteredViews() {
    renderFilterControls();
    renderTimeline();
  }

  function renderHeaderSummary() {
    var summary = stats.summarize(data.tasks, new Date());
    dom["header-pending"].textContent = summary.pending;
    dom["header-overdue"].textContent = summary.overdue;
  }

  function renderHomeSummary() {
    var summary = stats.summarize(data.tasks, new Date());
    dom["home-task-total"].textContent = summary.total;
    dom["home-completion-rate"].textContent = summary.completionRate + "%";
    dom["home-group-total"].textContent = data.groups.length;
    dom["home-flow-total"].textContent = data.flows.length;
    dom["home-material-total"].textContent = data.materials.length;
    dom["home-note-total"].textContent = data.notes.length;
  }

  function renderFilterControls() {
    dom["filter-search"].value = ui.filters.search;
    dom["filter-status"].value = ui.filters.status;
    dom["filter-urgency"].value = ui.filters.urgency;
    dom["filter-flow"].value = ui.filters.flowId;
    dom["filter-overdue"].checked = ui.filters.overdueOnly;
    renderGroupFilterOptions();
    renderFlowFilterOptions();
    renderStatusFilterOptions();
    renderUrgencyFilterOptions();
    renderActiveFilters();
  }

  function renderGroupFilterOptions() {
    var container = utils.clear(dom["group-filter-options"]);
    var sortedGroups = getSortedGroups();
    if (!sortedGroups.length) {
      var empty = utils.el("p", "modal-context", "还没有分组");
      empty.style.padding = "7px";
      empty.style.margin = "0";
      container.appendChild(empty);
    } else {
      sortedGroups.forEach(function (group) {
        var label = utils.el("label", "check-option");
        var checkbox = utils.el("input");
        checkbox.type = "checkbox";
        checkbox.value = group.id;
        checkbox.dataset.groupFilter = "true";
        checkbox.checked = ui.filters.groupIds.includes(group.id);
        var swatch = utils.el("i", "group-swatch");
        swatch.style.setProperty("--swatch", group.color);
        var text = utils.el("span", "", group.name);
        label.append(checkbox, swatch, text);
        container.appendChild(label);
      });
    }
    dom["group-filter-count"].textContent = ui.filters.groupIds.length
      ? ui.filters.groupIds.length + " 个"
      : "全部";
  }

  function appendTimelineFilterOption(container, config) {
    var label = utils.el("label", "check-option choice-option");
    var input = utils.el("input");
    input.type = "radio";
    input.name = "timeline-" + config.kind;
    input.value = config.value;
    input.checked = config.checked;
    input.dataset.timelineFilter = config.kind;
    label.appendChild(input);
    if (config.color) {
      var swatch = utils.el("i", "group-swatch");
      swatch.style.setProperty("--swatch", config.color);
      label.appendChild(swatch);
    }
    label.appendChild(utils.el("span", "", config.label));
    container.appendChild(label);
  }

  function renderFlowFilterOptions() {
    var container = utils.clear(dom["filter-flow-options"]);
    appendTimelineFilterOption(container, {
      kind: "flowId",
      value: "all",
      label: "全部 Flow",
      checked: ui.filters.flowId === "all"
    });
    appendTimelineFilterOption(container, {
      kind: "flowId",
      value: "none",
      label: "未加入 Flow",
      checked: ui.filters.flowId === "none",
      color: "#9aa4b7"
    });
    getSortedFlows().forEach(function (flow) {
      var group = getGroup(flow.groupId);
      appendTimelineFilterOption(container, {
        kind: "flowId",
        value: flow.id,
        label: [group && group.name, flow.name].filter(Boolean).join(" / "),
        checked: ui.filters.flowId === flow.id,
        color: flow.color
      });
    });
    if (
      ui.filters.flowId !== "all" &&
      ui.filters.flowId !== "none" &&
      !getFlow(ui.filters.flowId)
    ) {
      ui.filters.flowId = "all";
      dom["filter-flow"].value = "all";
    }
    var selectedFlow = getFlow(ui.filters.flowId);
    dom["filter-flow-label"].textContent =
      ui.filters.flowId === "none"
        ? "未加入"
        : selectedFlow
          ? selectedFlow.name
          : "全部";
  }

  function renderStatusFilterOptions() {
    var container = utils.clear(dom["filter-status-options"]);
    [
      ["all", "全部状态", null],
      ["pending", "未完成", "#5368d8"],
      ["completed", "已完成", "#258365"]
    ].forEach(function (item) {
      appendTimelineFilterOption(container, {
        kind: "status",
        value: item[0],
        label: item[1],
        checked: ui.filters.status === item[0],
        color: item[2]
      });
    });
    dom["filter-status-label"].textContent =
      ui.filters.status === "all" ? "全部" : statusLabels[ui.filters.status];
  }

  function renderUrgencyFilterOptions() {
    var container = utils.clear(dom["filter-urgency-options"]);
    [
      ["all", "全部紧急程度", null],
      ["high", "高", "#cf434d"],
      ["medium", "中", "#b5760d"],
      ["low", "低", "#16899c"]
    ].forEach(function (item) {
      appendTimelineFilterOption(container, {
        kind: "urgency",
        value: item[0],
        label: item[1],
        checked: ui.filters.urgency === item[0],
        color: item[2]
      });
    });
    dom["filter-urgency-label"].textContent =
      ui.filters.urgency === "all" ? "全部" : urgencyLabels[ui.filters.urgency];
  }

  function renderActiveFilters() {
    var container = utils.clear(dom["active-filters"]);
    var chips = [];
    if (ui.filters.search) chips.push("关键词：" + ui.filters.search);
    if (ui.filters.groupIds.length) {
      var names = ui.filters.groupIds
        .map(function (id) {
          var group = getGroup(id);
          return group ? group.name : "";
        })
        .filter(Boolean);
      chips.push("分组：" + names.join("、"));
    }
    if (ui.filters.flowId === "none") chips.push("Flow：未加入");
    else if (ui.filters.flowId !== "all") {
      var flow = getFlow(ui.filters.flowId);
      if (flow) chips.push("Flow：" + flow.name);
    }
    if (ui.filters.status !== "all") chips.push("状态：" + statusLabels[ui.filters.status]);
    if (ui.filters.urgency !== "all") chips.push("紧急程度：" + urgencyLabels[ui.filters.urgency]);
    if (ui.filters.overdueOnly) chips.push("仅看逾期");
    container.classList.toggle("has-filters", chips.length > 0);
    if (!chips.length) return;
    container.appendChild(utils.el("span", "active-filter-label", "筛选中"));
    chips.forEach(function (text) {
      container.appendChild(utils.el("span", "filter-chip", text));
    });
  }

  function hasActiveFilters() {
    return Boolean(
      ui.filters.search ||
        ui.filters.groupIds.length ||
        ui.filters.flowId !== "all" ||
        ui.filters.status !== "all" ||
        ui.filters.urgency !== "all" ||
        ui.filters.overdueOnly
    );
  }

  function clearFilters() {
    ui.filters = {
      search: "",
      groupIds: [],
      flowId: "all",
      status: "all",
      urgency: "all",
      overdueOnly: false
    };
    renderFilteredViews();
    closeDetailsMenus();
    toast("筛选已清空");
  }

  function getSortedGroups() {
    return data.groups.slice().sort(function (a, b) {
      return Number(a.order || 0) - Number(b.order || 0);
    });
  }

  function getSortedFlows(groupId) {
    return data.flows
      .filter(function (flow) {
        return !groupId || flow.groupId === groupId;
      })
      .sort(function (left, right) {
        if (left.groupId !== right.groupId) {
          var leftGroup = getGroup(left.groupId);
          var rightGroup = getGroup(right.groupId);
          var groupDifference =
            Number((leftGroup && leftGroup.order) || 0) -
            Number((rightGroup && rightGroup.order) || 0);
          if (groupDifference) return groupDifference;
        }
        return Number(left.order || 0) - Number(right.order || 0);
      });
  }

  function getGroup(id) {
    return data.groups.find(function (group) {
      return group.id === id;
    });
  }

  function getFlow(id) {
    return data.flows.find(function (flow) {
      return flow.id === id;
    });
  }

  function getTask(id) {
    return data.tasks.find(function (task) {
      return task.id === id;
    });
  }

  function getNote(id) {
    return data.notes.find(function (note) {
      return note.id === id;
    });
  }

  function getMaterial(id) {
    return data.materials.find(function (material) {
      return material.id === id;
    });
  }

  function getTaskMaterials(taskId) {
    return materialTools.forTask(data.materials, taskId);
  }

  function getTaskTimelineOccurrences(task) {
    return dates.isRecurringTask(task)
      ? dates.getRecurringOccurrences(task)
      : [{ ddl: dates.formatDate(task && task.ddl), periodKey: "" }];
  }

  function getTimelineDays() {
    var monday = dates.startOfWeek(ui.timelineDayAnchor || ui.timelineAnchor);
    if (!monday) return [];
    return Array.from({ length: 7 }, function (_item, index) {
      return dates.addDays(monday, index);
    });
  }

  function scopeTasksToTimelineGranularity(tasks) {
    if (ui.timelineGranularity !== "day") return tasks;
    var days = getTimelineDays();
    var start = days[0];
    var end = days[days.length - 1];
    if (!start || !end) return [];
    return tasks.filter(function (task) {
      return getTaskTimelineOccurrences(task).some(function (occurrence) {
        return occurrence.ddl >= start && occurrence.ddl <= end;
      });
    });
  }

  function getVisibleTasks() {
    var visible = stats.filterTasks(data.tasks, ui.filters, new Date(), data.flows);
    if (!ui.filters.search) return scopeTasksToTimelineGranularity(visible);
    var materialTaskIds = new Set();
    var needle = utils.normalizeText(ui.filters.search);
    data.materials.forEach(function (material) {
      var haystack = utils.normalizeText(
        [material.title, material.url, materialTools.typeLabel(material.type), material.note].join(
          " "
        )
      );
      if (!haystack.includes(needle)) return;
      material.taskIds.forEach(function (taskId) {
        materialTaskIds.add(taskId);
      });
    });
    var filtersWithoutSearch = Object.assign({}, ui.filters, { search: "" });
    var base = stats.filterTasks(data.tasks, filtersWithoutSearch, new Date(), data.flows);
    var visibleIds = new Set(
      visible.map(function (task) {
        return task.id;
      })
    );
    base.forEach(function (task) {
      if (materialTaskIds.has(task.id) && !visibleIds.has(task.id)) {
        visible.push(task);
        visibleIds.add(task.id);
      }
    });
    return scopeTasksToTimelineGranularity(stats.sortTasks(visible, new Date()));
  }

  function getTimelineWeeks() {
    if (ui.timelineMode === "all") {
      return excelExport.timelineWeeks(data.tasks, new Date());
    }
    var start = dates.addWeeksFriday(ui.timelineAnchor, -ui.windowPastWeeks);
    var end = dates.addWeeksFriday(ui.timelineAnchor, ui.windowFutureWeeks);
    return dates.buildWeekRange(start, end);
  }

  function getTimelineColumns() {
    return ui.timelineGranularity === "day" ? getTimelineDays() : getTimelineWeeks();
  }

  function syncTimelineGranularityChrome(columns) {
    var dayMode = ui.timelineGranularity === "day";
    dom["timeline-heading"].textContent = dayMode ? "Task by Day" : "Task by Week";
    dom["timeline-subtitle"].textContent = i18n.isEnglish()
      ? dayMode
        ? "Monday to Sunday · Deadlines shown by day"
        : "Monday to Sunday · Headers show Friday · Double-click a week to view each day"
      : dayMode
        ? "周一至周日 · DDL 精确到天"
        : "周一至周日 · 表头显示周五 · 双击周表头查看每天";
    dom["timeline-current-label"].textContent = i18n.isEnglish()
      ? dayMode
        ? "Today"
        : "This Week"
      : dayMode
        ? "今天"
        : "本周";
    dom["timeline-week-range-controls"].hidden = dayMode;
    dom["timeline-week-return"].hidden = !dayMode;
    var rangeText = "";
    if (columns.length) {
      rangeText = i18n.isEnglish()
        ? dayMode
          ? columns[0] + " — " + columns[columns.length - 1] + " · Monday to Sunday"
          : columns[0] + " — " + columns[columns.length - 1] + " · " + columns.length + " weeks"
        : dayMode
          ? columns[0] + " — " + columns[columns.length - 1] + " · 周一至周日"
          : columns[0] + " — " + columns[columns.length - 1] + " · " + columns.length + " 周";
    }
    dom["range-label"].textContent = rangeText;
    dom["range-label"].title = rangeText;
  }

  function renderTimeline() {
    var visibleTasks = getVisibleTasks();
    var columns = getTimelineColumns();
    var dayMode = ui.timelineGranularity === "day";
    var board = utils.clear(dom["timeline-board"]);
    board.classList.toggle("is-day-view", dayMode);
    board.style.setProperty("--week-count", columns.length);
    board.dataset.timelineGranularity = dayMode ? "day" : "week";
    syncTimelineGranularityChrome(columns);
    dom["visible-result-count"].textContent = visibleTasks.length + " 条可见 Task";

    if (!data.groups.length) {
      board.appendChild(
        createEmptyState(
          i18n.isEnglish() ? "Create Your First Group" : "先建立第一个分组",
          i18n.isEnglish()
            ? "Every Task belongs to a Group. Create one to start planning on the weekly timeline."
            : "Task 必须归属分组。建立分组后即可开始安排周时间轴。",
          i18n.isEnglish() ? "New Group" : "新建分组",
          openNewGroup
        )
      );
      return;
    }
    if (dayMode && visibleTasks.length === 0) {
      board.appendChild(createTimelineHeader(columns));
      board.appendChild(
        createEmptyState(
          i18n.isEnglish()
            ? hasActiveFilters()
              ? "No Tasks Match the Filters This Week"
              : "No Task Deadlines This Week"
            : hasActiveFilters()
              ? "该周没有符合筛选条件的 Task"
              : "该周没有 Task DDL",
          hasActiveFilters()
            ? i18n.isEnglish()
              ? "Clear the filters to review this week, or return to Task by Week and choose another week."
              : "清空筛选后可继续查看该周，或返回 Task by Week 选择其他周。"
            : i18n.isEnglish()
              ? "Return to Task by Week, then double-click another week header to continue."
              : "返回 Task by Week 后，可双击其他周的日期框继续查看。",
          i18n.isEnglish()
            ? hasActiveFilters()
              ? "Clear Filters"
              : "Return to Task by Week"
            : hasActiveFilters()
              ? "清空筛选"
              : "返回 Task by Week",
          hasActiveFilters() ? clearFilters : returnToWeekTimeline
        )
      );
      return;
    }
    if (hasActiveFilters() && visibleTasks.length === 0) {
      board.appendChild(
        createEmptyState(
          i18n.isEnglish() ? "No Tasks Match the Filters" : "没有符合条件的 Task",
          i18n.isEnglish()
            ? "Remove one or more filters, or clear them to view every Task."
            : "尝试减少筛选条件，或清空筛选查看全部 Task。",
          i18n.isEnglish() ? "Clear Filters" : "清空筛选",
          clearFilters
        )
      );
      return;
    }

    board.appendChild(createTimelineHeader(columns));
    var visibleIds = new Set(
      visibleTasks.map(function (task) {
        return task.id;
      })
    );
    var scopedTimeline = hasActiveFilters() || dayMode;
    var groupsToShow = getSortedGroups().filter(function (group) {
      if (!scopedTimeline) return true;
      return visibleTasks.some(function (task) {
        return task.groupId === group.id;
      });
    });
    groupsToShow.forEach(function (group) {
      var groupTasks = data.tasks.filter(function (task) {
        return task.groupId === group.id && visibleIds.has(task.id);
      });
      var groupFlows = getSortedFlows(group.id).filter(function (flow) {
        return (
          !scopedTimeline ||
          groupTasks.some(function (task) {
            return task.flowId === flow.id;
          })
        );
      });
      var standaloneTasks = stats.sortTasks(
        groupTasks.filter(function (task) {
          return !task.flowId;
        }),
        new Date()
      );
      board.appendChild(createGroupRow(group, groupTasks, columns));
      if (!group.collapsed) {
        groupFlows.forEach(function (flow) {
          var flowTasks = stats.sortFlowTasks(
            groupTasks.filter(function (task) {
              return task.flowId === flow.id;
            }),
            new Date()
          );
          board.appendChild(createFlowRow(flow, group, flowTasks, columns));
          if (!flow.collapsed) {
            if (!flowTasks.length) board.appendChild(createEmptyFlowRow(flow, group, columns));
            flowTasks.forEach(function (task) {
              board.appendChild(createTaskRow(task, group, columns, flow, task.flowOrder));
            });
          }
        });
        standaloneTasks.forEach(function (task) {
          board.appendChild(createTaskRow(task, group, columns, null, null));
        });
        if (!groupTasks.length && !groupFlows.length) {
          board.appendChild(createEmptyGroupRow(group, columns));
        }
      }
    });
  }

  function weekdayLabel(value) {
    var date = dates.parseISODate(value);
    return date
      ? (i18n.isEnglish()
          ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
          : ["周日", "周一", "周二", "周三", "周四", "周五", "周六"])[date.getDay()]
      : "";
  }

  function createTimelineHeader(columns) {
    var row = utils.el("div", "timeline-header");
    var corner = utils.el("div", "timeline-corner");
    (i18n.isEnglish()
      ? ["Task / DDL", "Urgency", "Progress", "Documents", "Edit"]
      : ["Task / DDL", "紧急", "进度记录", "相关资料", "编辑"]
    ).forEach(function (label) {
      corner.appendChild(utils.el("span", "", label));
    });
    row.appendChild(corner);
    if (ui.timelineGranularity === "day") {
      var today = dates.todayISO();
      columns.forEach(function (day) {
        var head = utils.el("div", "week-head day-head" + (day === today ? " is-current" : ""));
        head.dataset.day = day;
        head.appendChild(
          utils.el("small", "week-range", i18n.isEnglish() ? day.slice(0, 4) : day.slice(0, 4) + " 年")
        );
        head.appendChild(utils.el("strong", "week-date", day.slice(5).replace("-", "/")));
        head.appendChild(utils.el("span", "week-year", weekdayLabel(day)));
        if (day === today) {
          head.appendChild(utils.el("b", "week-current-badge", i18n.isEnglish() ? "Today" : "今天"));
        }
        row.appendChild(head);
      });
      return row;
    }
    var currentFriday = dates.getWeekFriday(new Date());
    columns.forEach(function (friday) {
      var head = utils.el(
        "div",
        "week-head is-drillable" + (friday === currentFriday ? " is-current" : "")
      );
      head.dataset.week = friday;
      head.tabIndex = 0;
      head.setAttribute("role", "button");
      head.setAttribute(
        "aria-label",
        i18n.isEnglish()
          ? "Double-click to view the daily timeline for " + dates.friendlyWeekLabel(friday)
          : "双击查看 " + dates.friendlyWeekLabel(friday) + " 的日时间轴"
      );
      head.title = i18n.isEnglish()
        ? "Double-click to open Task by Day for this week"
        : "双击进入该周的 Task by Day";
      head.appendChild(utils.el("small", "week-range", dates.friendlyWeekLabel(friday)));
      head.appendChild(utils.el("strong", "week-date", friday.slice(5).replace("-", "/")));
      head.appendChild(
        utils.el(
          "span",
          "week-year",
          friday.slice(0, 4) + (i18n.isEnglish() ? " · Friday" : " · 周五")
        )
      );
      if (friday === currentFriday) {
        head.appendChild(utils.el("b", "week-current-badge", i18n.isEnglish() ? "This Week" : "本周"));
      }
      head.addEventListener("dblclick", function () {
        openDayTimeline(friday);
      });
      head.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openDayTimeline(friday);
      });
      row.appendChild(head);
    });
    return row;
  }

  function applyGroupVariables(node, group) {
    node.style.setProperty("--group-color", group.color);
    node.style.setProperty("--group-soft", utils.rgba(group.color, 0.08));
    node.style.setProperty("--group-soft-solid", utils.blendWithWhite(group.color, 0.9));
    node.style.setProperty("--group-border", utils.rgba(group.color, 0.24));
    node.style.setProperty("--group-wash", utils.rgba(group.color, 0.045));
    node.style.setProperty("--group-medium", utils.rgba(group.color, 0.16));
  }

  function applyFlowVariables(node, flow) {
    node.style.setProperty("--flow-color", flow.color);
    node.style.setProperty("--flow-soft", utils.rgba(flow.color, 0.075));
    node.style.setProperty("--flow-border", utils.rgba(flow.color, 0.24));
    node.style.setProperty("--flow-medium", utils.rgba(flow.color, 0.16));
  }

  function isCurrentTimelineColumn(column) {
    return ui.timelineGranularity === "day"
      ? column === dates.todayISO()
      : column === dates.getWeekFriday(new Date());
  }

  function createGroupRow(group, groupTasks, columns) {
    var summary = stats.summarize(groupTasks, new Date());
    var row = utils.el("div", "group-row" + (group.collapsed ? " is-collapsed" : ""));
    row.dataset.groupId = group.id;
    applyGroupVariables(row, group);

    var left = utils.el("div", "group-left");
    var collapse = utils.el("button", "collapse-button", "⌄");
    collapse.type = "button";
    collapse.setAttribute("aria-label", group.collapsed ? "展开分组" : "收起分组");
    collapse.addEventListener("click", function () {
      toggleGroupCollapsed(group.id);
    });
    var emblem = utils.el("span", "group-emblem", group.name.trim().slice(0, 1).toUpperCase());
    emblem.setAttribute("aria-hidden", "true");
    var identity = utils.el("span", "group-identity");
    var name = utils.el("span", "group-name", group.name);
    name.title = group.name;
    identity.append(name, utils.el("small", "", summary.total + " TASKS"));

    var ring = utils.el("span", "group-progress-ring");
    ring.style.setProperty("--progress", summary.completionRate + "%");
    ring.title = "完成率 " + summary.completionRate + "%";
    ring.appendChild(utils.el("b", "", Math.round(summary.completionRate) + "%"));

    var stackPanel = utils.el("span", "group-stack-panel");
    stackPanel.title = hasActiveFilters() ? "当前筛选结果统计" : "全部 Task 统计";
    var stack = utils.el("span", "group-stack");
    var active = Math.max(0, summary.pending - summary.overdue);
    [
      ["is-completed", summary.completed],
      ["is-active", active],
      ["is-overdue", summary.overdue]
    ].forEach(function (part) {
      var segment = utils.el("i", part[0]);
      segment.style.width = percentage(part[1], summary.total) + "%";
      stack.appendChild(segment);
    });
    var counts = utils.el("span", "group-mini-stats");
    counts.append(
      countFragment("✓", summary.completed, "completed-count"),
      countFragment("○", active, "active-count"),
      countFragment("!", summary.overdue, "overdue-count")
    );
    stackPanel.append(stack, counts);

    var edit = utils.el("button", "group-edit", "编辑");
    edit.type = "button";
    edit.addEventListener("click", function () {
      openEditGroup(group.id);
    });
    left.append(collapse, emblem, identity, ring, stackPanel, edit);
    row.appendChild(left);

    columns.forEach(function (column) {
      row.appendChild(
        utils.el("div", "group-week-cell" + (isCurrentTimelineColumn(column) ? " is-current" : ""))
      );
    });
    return row;
  }

  function createFlowRow(flow, group, flowTasks, columns) {
    var summary = stats.summarize(flowTasks, new Date());
    var row = utils.el("div", "flow-row" + (flow.collapsed ? " is-collapsed" : ""));
    row.dataset.flowId = flow.id;
    applyGroupVariables(row, group);
    applyFlowVariables(row, flow);

    var left = utils.el("div", "flow-left");
    var hierarchy = utils.el("span", "flow-hierarchy", "↳");
    hierarchy.setAttribute("aria-hidden", "true");
    var collapse = utils.el("button", "collapse-button flow-collapse", "⌄");
    collapse.type = "button";
    collapse.setAttribute("aria-label", flow.collapsed ? "展开 Flow" : "收起 Flow");
    collapse.addEventListener("click", function () {
      toggleFlowCollapsed(flow.id);
    });
    var emblem = utils.el("span", "flow-emblem", "F");
    emblem.setAttribute("aria-hidden", "true");
    var identity = utils.el("span", "flow-identity");
    var name = utils.el("span", "flow-name", flow.name);
    name.title = group.name + " / " + flow.name;
    identity.append(name, utils.el("small", "", summary.total + " STEPS · " + group.name));

    var ring = utils.el("span", "flow-progress-ring");
    ring.style.setProperty("--progress", summary.completionRate + "%");
    ring.title = "Flow 完成率 " + summary.completionRate + "%";
    ring.appendChild(utils.el("b", "", Math.round(summary.completionRate) + "%"));

    var stackPanel = utils.el("span", "flow-stack-panel");
    var stack = utils.el("span", "group-stack");
    var active = Math.max(0, summary.pending - summary.overdue);
    [
      ["is-completed", summary.completed],
      ["is-active", active],
      ["is-overdue", summary.overdue]
    ].forEach(function (part) {
      var segment = utils.el("i", part[0]);
      segment.style.width = percentage(part[1], summary.total) + "%";
      stack.appendChild(segment);
    });
    var counts = utils.el("span", "group-mini-stats");
    counts.append(
      countFragment("✓", summary.completed, "completed-count"),
      countFragment("○", active, "active-count"),
      countFragment("!", summary.overdue, "overdue-count")
    );
    stackPanel.append(stack, counts);

    var edit = utils.el("button", "flow-edit", "编辑");
    edit.type = "button";
    edit.setAttribute("aria-label", "编辑 Flow " + flow.name);
    edit.addEventListener("click", function () {
      openEditFlow(flow.id);
    });
    left.append(hierarchy, collapse, emblem, identity, ring, stackPanel, edit);
    row.appendChild(left);

    columns.forEach(function (column) {
      row.appendChild(
        utils.el("div", "flow-week-cell" + (isCurrentTimelineColumn(column) ? " is-current" : ""))
      );
    });
    return row;
  }

  function countFragment(label, value, extraClass) {
    var span = utils.el("span", extraClass || "");
    span.append(label + " ", utils.el("b", "", value));
    return span;
  }

  function percentage(value, total) {
    return total > 0 ? Math.max(0, Math.min(100, (Number(value || 0) / total) * 100)) : 0;
  }

  function createEmptyGroupRow(group, columns) {
    var row = utils.el("div", "task-row");
    applyGroupVariables(row, group);
    var info = utils.el("div", "task-info");
    var message = utils.el("div", "task-main");
    message.appendChild(utils.el("span", "task-meta", "该分组还没有 Task"));
    info.appendChild(message);
    row.appendChild(info);
    columns.forEach(function (column) {
      row.appendChild(
        utils.el("div", "timeline-cell" + (isCurrentTimelineColumn(column) ? " is-current" : ""))
      );
    });
    return row;
  }

  function createEmptyFlowRow(flow, group, columns) {
    var row = utils.el("div", "task-row is-flow-task is-empty-flow");
    applyGroupVariables(row, group);
    applyFlowVariables(row, flow);
    var info = utils.el("div", "task-info");
    var message = utils.el("div", "task-main");
    message.appendChild(
      utils.el("span", "task-meta", "该 Flow 还没有步骤，可在新建或编辑 Task 时加入")
    );
    info.appendChild(message);
    row.appendChild(info);
    columns.forEach(function (column) {
      row.appendChild(
        utils.el("div", "timeline-cell" + (isCurrentTimelineColumn(column) ? " is-current" : ""))
      );
    });
    return row;
  }

  function createTaskRow(task, group, columns, flow, stepNumber) {
    var now = new Date();
    var today = dates.todayISO(now);
    var periodState = dates.getTaskPeriodState(task, now);
    var recurring = periodState.recurring;
    var overdue = periodState.overdue;
    var completed = periodState.completed;
    var rowClass = "task-row";
    if (flow) rowClass += " is-flow-task";
    if (overdue) rowClass += " is-overdue";
    if (completed) rowClass += " is-completed";
    var row = utils.el("div", rowClass);
    row.dataset.taskId = task.id;
    applyGroupVariables(row, group);
    if (flow) applyFlowVariables(row, flow);

    var info = utils.el("div", "task-info");
    var main = utils.el("div", "task-main");
    var checkLabel = utils.el("label", "complete-check");
    var checkbox = utils.el("input");
    checkbox.type = "checkbox";
    checkbox.checked = completed;
    checkbox.disabled = recurring && !periodState.checkboxEnabled;
    checkbox.setAttribute(
      "aria-label",
      i18n.isEnglish()
        ? recurring
          ? periodState.checkboxEnabled
            ? (completed ? "Clear" : "Confirm") +
              " the DDL completion status for the current natural " +
              (periodState.cadence === "weekly" ? "week" : "month")
            : "This recurring Task cannot be completed in the current period"
          : completed
            ? "Restore to incomplete"
            : "Mark as completed"
        : recurring
          ? periodState.checkboxEnabled
            ? (completed ? "取消" : "确认") +
              "当前自然" +
              (periodState.cadence === "weekly" ? "周" : "月") +
              "的 DDL 完成状态"
            : "当前不在周期 Task 的可确认范围内"
          : completed
            ? "恢复为未完成"
            : "标记为已完成"
    );
    if (checkbox.disabled) {
      checkbox.title = i18n.isEnglish()
        ? "The current period can be completed after the recurrence becomes active"
        : "进入有效自然周期后可确认本期完成状态";
    }
    checkbox.addEventListener("change", function () {
      toggleTaskCompleted(task.id, checkbox.checked);
    });
    checkLabel.appendChild(checkbox);
    var titleWrap = utils.el("div", "task-title-wrap");
    var title = utils.el("button", "task-title", task.name);
    title.type = "button";
    title.title = task.name;
    title.addEventListener("click", function () {
      openEditTask(task.id);
    });
    var meta = utils.el("div", "task-meta");
    if (flow) {
      meta.appendChild(
        utils.el("span", "flow-step-label", "STEP " + String(stepNumber || 1).padStart(2, "0"))
      );
    }
    meta.appendChild(
      utils.el(
        "span",
        "",
        (i18n.isEnglish() ? recurring ? "DDL Anchor " : "DDL " : recurring ? "DDL 基准 " : "DDL ") +
          task.ddl
      )
    );
    if (recurring) {
      meta.appendChild(
        utils.el(
          "span",
          "recurrence-badge",
          automation.cadenceLabel(periodState.cadence) +
            " · " +
            task.recurrenceStart +
            (i18n.isEnglish() ? " to " : " 至 ") +
            task.recurrenceEnd
        )
      );
    }
    if (overdue) {
      meta.appendChild(
        utils.el("span", "status-label overdue", i18n.isEnglish() ? "⚠ Overdue" : "⚠ 本期逾期")
      );
    } else if (completed) {
      meta.appendChild(
        utils.el("span", "status-label completed", recurring ? "✓ 本期已完成" : "✓ 已完成")
      );
    } else if (recurring && !periodState.checkboxEnabled) {
      meta.appendChild(
        utils.el(
          "span",
          "status-label",
          today < task.recurrenceStart
            ? i18n.isEnglish() ? "Recurrence Not Started" : "周期未开始"
            : today > task.recurrenceEnd
              ? i18n.isEnglish() ? "Recurrence Ended" : "周期已结束"
              : i18n.isEnglish() ? "No DDL This Period" : "本期无 DDL"
        )
      );
    } else {
      meta.appendChild(
        utils.el(
          "span",
          "status-label",
          i18n.isEnglish() ? recurring ? "Period Incomplete" : "Incomplete" : recurring ? "本期未完成" : "未完成"
        )
      );
    }
    titleWrap.append(title, meta);
    main.append(checkLabel, titleWrap);

    var urgencyIcons = { high: "◆", medium: "●", low: "○" };
    var urgency = utils.el(
      "span",
      "urgency-badge " + task.urgency,
      urgencyIcons[task.urgency] + " " + urgencyLabels[task.urgency]
    );
    var progressButton = createProgressButton(task);
    var materialButton = createMaterialButton(task);
    var editButton = utils.el("button", "task-icon-button", "⋯");
    editButton.type = "button";
    editButton.title = i18n.isEnglish() ? "Edit Task" : "编辑 Task";
    editButton.setAttribute("aria-label", (i18n.isEnglish() ? "Edit " : "编辑 ") + task.name);
    editButton.addEventListener("click", function () {
      openEditTask(task.id);
    });
    info.append(main, urgency, progressButton, materialButton, editButton);
    row.appendChild(info);

    var occurrences = getTaskTimelineOccurrences(task);
    var occurrencesByColumn = new Map();
    occurrences.forEach(function (occurrence) {
      var column = ui.timelineGranularity === "day"
        ? occurrence.ddl
        : dates.getWeekFriday(occurrence.ddl);
      if (!occurrencesByColumn.has(column)) occurrencesByColumn.set(column, []);
      occurrencesByColumn.get(column).push(occurrence);
    });
    columns.forEach(function (column) {
      var cell = utils.el(
        "div",
        "timeline-cell" + (isCurrentTimelineColumn(column) ? " is-current" : "")
      );
      cell.dataset.date = column;
      (occurrencesByColumn.get(column) || []).forEach(function (occurrence) {
        var occurrenceCompleted = recurring
          ? Boolean(dates.getRecurringCompletion(task, occurrence))
          : completed;
        var occurrenceOverdue = !occurrenceCompleted && occurrence.ddl < today;
        var nodeState = occurrenceOverdue
          ? "overdue"
          : occurrenceCompleted
            ? "completed"
            : task.urgency;
        var nodeSymbols = {
          overdue: "!",
          completed: "✓",
          high: "◆",
          medium: "●",
          low: "○"
        };
        var node = utils.el("button", "task-node node-" + nodeState);
        node.type = "button";
        node.title = buildTaskTooltip(
          task,
          group,
          occurrence,
          occurrenceCompleted,
          occurrenceOverdue,
          flow
        );
        node.append(
          utils.el("i", "task-node-symbol", nodeSymbols[nodeState]),
          utils.el("span", "task-node-label", task.name)
        );
        node.addEventListener("click", function () {
          openEditTask(task.id);
        });
        cell.appendChild(node);
      });
      row.appendChild(cell);
    });
    return row;
  }

  function buildTaskTooltip(task, group, occurrence, completed, overdue, flow) {
    var recurring = dates.isRecurringTask(task);
    if (i18n.isEnglish()) {
      return [
        task.name,
        "Group: " + group.name,
        flow ? "Flow: " + flow.name + " · STEP " + String(task.flowOrder || 1).padStart(2, "0") : "",
        recurring
          ? "Recurrence: " + automation.cadenceLabel(dates.recurrenceCadence(task)) +
            " · " + task.recurrenceStart + " to " + task.recurrenceEnd
          : "",
        "DDL: " + occurrence.ddl + " (" + weekdayLabel(occurrence.ddl) + ")",
        "Urgency: " + urgencyLabels[task.urgency],
        "Status: " + (overdue ? "Overdue" : completed ? "Completed" : "Incomplete"),
        task.reportTo ? "Report To: " + task.reportTo : "",
        task.managedObject ? "Managed Person: " + task.managedObject : "",
        task.deliverable ? "Deliverable: " + task.deliverable : "",
        task.progressNote
          ? "Progress: " + task.progressNote.replace(/\s+/g, " ").slice(0, 120)
          : ""
      ]
        .filter(Boolean)
        .join("\n");
    }
    return [
      task.name,
      "分组：" + group.name,
      flow ? "Flow：" + flow.name + " · STEP " + String(task.flowOrder || 1).padStart(2, "0") : "",
      recurring
        ? "周期：" + automation.cadenceLabel(dates.recurrenceCadence(task)) +
          " · " + task.recurrenceStart + " 至 " + task.recurrenceEnd
        : "",
      "DDL：" + occurrence.ddl + "（" + weekdayLabel(occurrence.ddl) + "）",
      "紧急程度：" + urgencyLabels[task.urgency],
      "状态：" + (overdue ? "逾期" : completed ? "已完成" : "未完成"),
      task.reportTo ? "汇报对象：" + task.reportTo : "",
      task.managedObject ? "管理对象：" + task.managedObject : "",
      task.deliverable ? "交付物：" + task.deliverable : "",
      task.progressNote
        ? "进度：" + task.progressNote.replace(/\s+/g, " ").slice(0, 120)
        : ""
    ]
      .filter(Boolean)
      .join("\n");
  }

  function createProgressButton(task) {
    var entries = richText.sortProgressEntries(task.progressEntries || []);
    var hasProgress = entries.length > 0;
    var latest = entries[0];
    var button = utils.el(
      "button",
      "link-button progress-button" + (hasProgress ? " has-progress" : ""),
      i18n.isEnglish()
        ? "Progress (" + entries.length + ")"
        : "进度（" + entries.length + "）"
    );
    button.type = "button";
    button.title = i18n.isEnglish()
      ? hasProgress
        ? "Double-click to manage progress history\n" + latest.contentText.replace(/\s+/g, " ").slice(0, 160)
        : "Double-click to add a progress record"
      : hasProgress
        ? "双击管理进度历史\n" + latest.contentText.replace(/\s+/g, " ").slice(0, 160)
        : "双击添加进度记录";
    button.setAttribute(
      "aria-label",
      i18n.isEnglish()
        ? entries.length + " progress records; double-click or press Enter to manage"
        : "进度记录，共 " + entries.length + " 条；双击或按回车管理"
    );
    button.addEventListener("dblclick", function (event) {
      event.preventDefault();
      openProgressManager(task.id);
    });
    button.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openProgressManager(task.id);
      }
    });
    return button;
  }

  function createMaterialButton(task) {
    var materials = getTaskMaterials(task.id);
    var button = utils.el(
      "button",
      "link-button material-button" + (materials.length ? " has-links" : ""),
      i18n.isEnglish()
        ? "Documents (" + materials.length + ")"
        : "资料（" + materials.length + "）"
    );
    button.type = "button";
    button.title = i18n.isEnglish()
      ? "Double-click to manage related documents"
      : "双击管理相关资料";
    button.setAttribute(
      "aria-label",
      i18n.isEnglish()
        ? materials.length + " related documents; double-click or press Enter to manage"
        : "相关资料，" + materials.length + " 条；双击或按回车管理"
    );
    button.addEventListener("dblclick", function (event) {
      event.preventDefault();
      openLinkManager(task.id);
    });
    button.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLinkManager(task.id);
      }
    });
    return button;
  }

  function createEmptyState(title, description, buttonText, handler) {
    var state = utils.el("div", "empty-state");
    var inner = utils.el("div");
    var mark = utils.el("span", "empty-state-mark");
    for (var i = 0; i < 6; i += 1) mark.appendChild(utils.el("i"));
    inner.appendChild(mark);
    inner.appendChild(utils.el("h2", "", title));
    inner.appendChild(utils.el("p", "", description));
    var button = utils.el("button", "button button-primary", buttonText);
    button.type = "button";
    button.addEventListener("click", handler);
    inner.appendChild(button);
    state.appendChild(inner);
    return state;
  }

  function toggleGroupCollapsed(groupId) {
    var group = getGroup(groupId);
    if (!group) return;
    group.collapsed = !group.collapsed;
    group.updatedAt = new Date().toISOString();
    persistAndRenderTimelineCollapse("group", group.id);
  }

  function toggleFlowCollapsed(flowId) {
    var flow = getFlow(flowId);
    if (!flow) return;
    flow.collapsed = !flow.collapsed;
    flow.updatedAt = new Date().toISOString();
    persistAndRenderTimelineCollapse("flow", flow.id);
  }

  function setAllGroupsCollapsed(collapsed) {
    if (!data.groups.length) {
      toast("当前没有可" + (collapsed ? "折叠" : "展开") + "的分组", "warning");
      return;
    }
    var changed = false;
    var stamp = new Date().toISOString();
    data.groups.forEach(function (group) {
      if (group.collapsed !== collapsed) {
        group.collapsed = collapsed;
        group.updatedAt = stamp;
        changed = true;
      }
    });
    data.flows.forEach(function (flow) {
      if (flow.collapsed !== collapsed) {
        flow.collapsed = collapsed;
        flow.updatedAt = stamp;
        changed = true;
      }
    });
    if (!changed) {
      toast(collapsed ? "所有分组与 Flow 已是折叠状态" : "所有分组与 Flow 已是展开状态");
      return;
    }
    persistAndRender(
      collapsed ? "已折叠全部分组与 Flow" : "已展开全部分组与 Flow"
    );
  }

  function toggleTaskCompleted(taskId, completed) {
    var task = getTask(taskId);
    if (!task) return;
    if (dates.isRecurringTask(task)) {
      var result = automation.setCurrentPeriodCompleted(task, completed, new Date());
      if (!result.changed) {
        toast("当前不在该周期 Task 的可确认范围内", "warning");
        return;
      }
    } else {
      task.status = completed ? "completed" : "pending";
      task.completedAt = completed ? dates.todayISO() : null;
    }
    task.updatedAt = new Date().toISOString();
    persistAndRenderTimelineAction(
      "task",
      task.id,
      dates.isRecurringTask(task)
        ? completed
          ? "本期 DDL 已确认完成"
          : "本期 DDL 已恢复为未完成"
        : completed
          ? "Task 已标记完成"
          : "Task 已恢复为未完成"
    );
  }

  function openDayTimeline(friday) {
    var normalized = dates.getWeekFriday(friday);
    if (!normalized) return;
    ui.weekTimelineViewport = captureTimelineViewport(null, null);
    ui.timelineGranularity = "day";
    ui.timelineDayAnchor = normalized;
    renderTimeline();
    window.requestAnimationFrame(function () {
      dom["timeline-scroll"].scrollTop = 0;
      dom["timeline-scroll"].scrollLeft = 0;
    });
  }

  function returnToWeekTimeline() {
    if (ui.timelineGranularity !== "day") return;
    var viewport = ui.weekTimelineViewport;
    ui.timelineGranularity = "week";
    ui.timelineDayAnchor = ui.timelineAnchor;
    ui.weekTimelineViewport = null;
    renderTimeline();
    restoreTimelineViewport(viewport);
  }

  function shiftTimeline(weeks) {
    ui.timelineGranularity = "week";
    ui.timelineMode = "window";
    ui.timelineAnchor = dates.addWeeksFriday(ui.timelineAnchor, weeks);
    renderTimeline();
  }

  function returnToCurrentWeek() {
    ui.timelineGranularity = "week";
    ui.timelineMode = "window";
    ui.timelineAnchor = dates.getWeekFriday(new Date());
    renderTimeline();
    requestAnimationFrame(scrollToCurrentWeek);
  }

  function showAllTaskRange() {
    ui.timelineGranularity = "week";
    ui.timelineMode = "all";
    renderTimeline();
    toast("已显示最早至最晚 DDL 的全部周范围");
  }

  function scrollToCurrentWeek() {
    if (ui.timelineGranularity !== "week") return;
    var current = query('.week-head[data-week="' + dates.getWeekFriday(new Date()) + '"]');
    if (!current) return;
    var leftRail = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-rail"));
    dom["timeline-scroll"].scrollTo({
      left: Math.max(0, current.offsetLeft - leftRail - 12),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  }

  function renderDashboard() {
    var summary = stats.summarize(data.tasks, new Date());
    renderMetricCards(summary);
    renderGroupDashboard();
    renderFlowDashboard();
    renderTaskFieldDashboard("managedObject", {
      cardContainerId: "managed-object-dashboard",
      tableBodyId: "managed-object-summary-body",
      emptyLabel: "未填写管理对象",
      fieldLabel: "管理对象",
      emblem: "管",
      color: "#0AA6B5"
    });
    renderTaskFieldDashboard("reportTo", {
      cardContainerId: "report-to-dashboard",
      tableBodyId: "report-to-summary-body",
      emptyLabel: "未填写汇报对象",
      fieldLabel: "汇报对象",
      emblem: "汇",
      color: "#665CFF"
    });
    dom["dashboard-scope"].textContent = "统计全部 " + summary.total + " 条 Task（不受时间轴筛选影响）";
    syncDashboardModuleView();
  }

  function renderMetricCards(summary) {
    var container = utils.clear(dom["metric-cards"]);
    var pendingRate = percentage(summary.pending, summary.total);
    var overdueRate = percentage(summary.overdue, summary.total);
    var metrics = [
      {
        label: "Task 总数",
        value: summary.total,
        note: data.groups.length + " 个分组 · " + data.flows.length + " 个 Flow",
        className: "total",
        icon: "▦",
        color: "#665CFF",
        progress: 100
      },
      {
        label: "已完成",
        value: summary.completed,
        note: "已退出当前逾期",
        className: "completed",
        icon: "✓",
        color: "#2CA77B",
        progress: summary.completionRate
      },
      {
        label: "未完成",
        value: summary.pending,
        note: "仍需推进",
        className: "pending",
        icon: "↗",
        color: "#0AA6B5",
        progress: pendingRate
      },
      {
        label: "当前逾期",
        value: summary.overdue,
        note: "点击查看逾期 Task",
        className: "overdue clickable",
        icon: "!",
        color: "#F05462",
        progress: overdueRate,
        click: function () {
          applyDashboardFilter(null, true);
        }
      },
      {
        label: "完成率",
        value: summary.completionRate + "%",
        note: summary.completed + " ÷ " + summary.total,
        className: "rate",
        icon: "%",
        color: "#F2A93B",
        progress: summary.completionRate
      }
    ];
    metrics.forEach(function (metric) {
      var card = utils.el("article", "metric-card " + metric.className);
      card.style.setProperty("--metric-color", metric.color);
      card.style.setProperty("--metric-soft", utils.rgba(metric.color, 0.1));
      card.style.setProperty("--metric-progress", metric.progress + "%");
      var head = utils.el("div", "metric-card-head");
      head.append(utils.el("span", "metric-icon", metric.icon), utils.el("p", "", metric.label));
      var copy = utils.el("div", "metric-card-copy");
      copy.append(utils.el("strong", "", metric.value), utils.el("small", "", metric.note));
      var ring = utils.el("span", "metric-ring");
      ring.appendChild(utils.el("i", "", Math.round(metric.progress) + "%"));
      var body = utils.el("div", "metric-card-body");
      body.append(copy, ring);
      card.append(head, body);
      if (metric.click) {
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.addEventListener("click", metric.click);
        card.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") metric.click();
        });
      }
      container.appendChild(card);
    });
  }

  function renderGroupDashboard() {
    var cardContainer = utils.clear(dom["group-dashboard"]);
    var tableBody = utils.clear(dom["group-summary-body"]);
    var summaries = stats.summarizeByGroup(data.groups, data.tasks, new Date());
    if (!summaries.length) {
      cardContainer.appendChild(
        createEmptyState("还没有分组", "建立分组后，这里会显示精确统计和完成进度。", "新建分组", openNewGroup)
      );
      var emptyRow = utils.el("tr");
      var emptyCell = utils.el("td", "", "暂无分组数据");
      emptyCell.colSpan = 6;
      emptyRow.appendChild(emptyCell);
      tableBody.appendChild(emptyRow);
      return;
    }
    summaries.forEach(function (item) {
      cardContainer.appendChild(createGroupCard(item));
      tableBody.appendChild(createGroupTableRow(item));
    });
  }

  function renderFlowDashboard() {
    var cardContainer = utils.clear(dom["flow-dashboard"]);
    var tableBody = utils.clear(dom["flow-summary-body"]);
    var summaries = stats.summarizeByFlow(data.flows, data.groups, data.tasks, new Date());
    if (!summaries.length) {
      cardContainer.appendChild(
        createEmptyState(
          "还没有 Flow",
          "Flow 可把同一分组内的 Task 组织为有顺序的工作步骤。",
          "新建 Flow",
          function () {
            openNewFlow();
          }
        )
      );
      var emptyRow = utils.el("tr");
      var emptyCell = utils.el("td", "", "暂无 Flow 数据");
      emptyCell.colSpan = 7;
      emptyRow.appendChild(emptyCell);
      tableBody.appendChild(emptyRow);
      return;
    }
    summaries.forEach(function (item) {
      cardContainer.appendChild(createFlowCard(item));
      tableBody.appendChild(createFlowTableRow(item));
    });
  }

  function toggleDashboardModule(module) {
    if (!["group", "flow", "managedObject", "reportTo"].includes(module)) return;
    ui.dashboardModule = ui.dashboardModule === module ? null : module;
    syncDashboardModuleView();
  }

  function syncDashboardModuleView() {
    var panels = {
      group: "dashboard-group-panel",
      flow: "dashboard-flow-panel",
      managedObject: "dashboard-managed-panel",
      reportTo: "dashboard-report-panel"
    };
    Object.keys(panels).forEach(function (module) {
      dom[panels[module]].hidden = ui.dashboardModule !== module;
    });
    queryAll("[data-dashboard-module]", dom["dashboard-module-nav"]).forEach(
      function (button) {
        var active = button.dataset.dashboardModule === ui.dashboardModule;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-expanded", String(active));
        button.setAttribute("aria-pressed", String(active));
      }
    );
  }

  function renderTaskFieldDashboard(field, config) {
    var cardContainer = utils.clear(dom[config.cardContainerId]);
    var tableBody = utils.clear(dom[config.tableBodyId]);
    var summaries = stats.summarizeByTaskField(
      data.tasks,
      field,
      new Date(),
      config.emptyLabel
    );
    if (!summaries.length) {
      cardContainer.appendChild(
        createEmptyState(
          "还没有 Task",
          "创建 Task 并填写" + config.fieldLabel + "后，这里会显示对应进度。",
          "前往时间轴",
          function () {
            switchView("timeline");
          }
        )
      );
      var emptyRow = utils.el("tr");
      var emptyCell = utils.el("td", "", "暂无" + config.fieldLabel + "数据");
      emptyCell.colSpan = 7;
      emptyRow.appendChild(emptyCell);
      tableBody.appendChild(emptyRow);
      return;
    }
    summaries.forEach(function (item) {
      cardContainer.appendChild(createPersonCard(field, item, config));
      tableBody.appendChild(createPersonTableRow(field, item, config));
    });
  }

  function createPersonExportButton(field, item, config, className, text) {
    var button = utils.el("button", className, text);
    button.type = "button";
    button.dataset.action = "export-person-task-status";
    button.dataset.scopeField = field;
    button.dataset.scopeValue = item.value;
    button.dataset.scopeLabel = item.label;
    button.style.setProperty("--group-color", config.color);
    button.setAttribute(
      "aria-label",
      "导出" + config.fieldLabel + "“" + item.label + "”的 Task 状态"
    );
    return button;
  }

  function createPersonCard(field, item, config) {
    var card = utils.el("article", "group-card person-card");
    card.style.setProperty("--group-color", config.color);
    card.style.setProperty("--group-soft", utils.rgba(config.color, 0.1));
    card.style.setProperty("--group-progress", item.completionRate + "%");
    var head = utils.el("div", "group-card-head");
    var identity = utils.el("div", "group-card-identity");
    identity.append(
      utils.el("span", "group-card-emblem", config.emblem),
      utils.el("div", "group-card-copy")
    );
    identity.lastChild.append(
      utils.el("strong", "", item.label),
      utils.el("small", "", item.total + " TASKS")
    );
    var ring = utils.el("span", "group-card-ring");
    ring.appendChild(utils.el("b", "", Math.round(item.completionRate) + "%"));
    head.append(identity, ring);

    var active = Math.max(0, item.pending - item.overdue);
    var progress = utils.el("div", "group-card-stack");
    [
      ["is-completed", item.completed],
      ["is-active", active],
      ["is-overdue", item.overdue]
    ].forEach(function (part) {
      var bar = utils.el("i", part[0]);
      bar.style.width = percentage(part[1], item.total) + "%";
      progress.appendChild(bar);
    });
    var footer = utils.el("div", "group-card-stats");
    footer.append(
      utils.el("span", "completed", "✓ 完成 " + item.completed),
      utils.el("span", "active", "○ 进行 " + active),
      utils.el("span", "overdue", "逾期 " + item.overdue)
    );
    var actions = utils.el("div", "person-card-actions");
    actions.appendChild(
      createPersonExportButton(
        field,
        item,
        config,
        "dashboard-export-button",
        "⇩ 导出 Task 状态"
      )
    );
    card.append(head, progress, footer, actions);
    return card;
  }

  function createPersonTableRow(field, item, config) {
    var row = utils.el("tr");
    var nameCell = utils.el("td");
    var identity = utils.el("span", "person-table-name");
    var swatch = utils.el("i", "group-swatch");
    swatch.style.setProperty("--swatch", config.color);
    identity.append(swatch, utils.el("span", "", item.label));
    nameCell.appendChild(identity);
    row.appendChild(nameCell);
    row.appendChild(utils.el("td", "", item.total));
    row.appendChild(utils.el("td", "", item.completed));
    row.appendChild(utils.el("td", "", item.pending));
    row.appendChild(utils.el("td", "", item.overdue));
    row.appendChild(utils.el("td", "", item.completionRate + "%"));
    var exportCell = utils.el("td");
    exportCell.appendChild(
      createPersonExportButton(
        field,
        item,
        config,
        "dashboard-table-export",
        "导出"
      )
    );
    row.appendChild(exportCell);
    return row;
  }

  function createGroupCard(item) {
    var card = utils.el("article", "group-card");
    card.style.setProperty("--group-color", item.group.color);
    card.style.setProperty("--group-soft", utils.rgba(item.group.color, 0.1));
    card.style.setProperty("--group-progress", item.completionRate + "%");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "查看分组 " + item.group.name);
    var head = utils.el("div", "group-card-head");
    var identity = utils.el("div", "group-card-identity");
    identity.append(
      utils.el("span", "group-card-emblem", item.group.name.trim().slice(0, 1).toUpperCase()),
      utils.el("div", "group-card-copy")
    );
    identity.lastChild.append(
      utils.el("strong", "", item.group.name),
      utils.el("small", "", item.total + " TASKS")
    );
    var ring = utils.el("span", "group-card-ring");
    ring.appendChild(utils.el("b", "", Math.round(item.completionRate) + "%"));
    head.append(identity, ring);

    var active = Math.max(0, item.pending - item.overdue);
    var progress = utils.el("div", "group-card-stack");
    [
      ["is-completed", item.completed],
      ["is-active", active],
      ["is-overdue", item.overdue]
    ].forEach(function (part) {
      var bar = utils.el("i", part[0]);
      bar.style.width = percentage(part[1], item.total) + "%";
      progress.appendChild(bar);
    });
    var footer = utils.el("div", "group-card-stats");
    footer.append(
      utils.el("span", "completed", "✓ 完成 " + item.completed),
      utils.el("span", "active", "○ 进行 " + active)
    );
    var overdue = utils.el("button", "table-overdue-button overdue", "逾期 " + item.overdue);
    overdue.type = "button";
    overdue.addEventListener("click", function (event) {
      event.stopPropagation();
      applyDashboardFilter(item.group.id, true);
    });
    footer.appendChild(overdue);
    card.append(head, progress, footer);
    card.addEventListener("click", function () {
      applyDashboardFilter(item.group.id, false);
    });
    card.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") applyDashboardFilter(item.group.id, false);
    });
    return card;
  }

  function createGroupTableRow(item) {
    var row = utils.el("tr");
    var groupCell = utils.el("td");
    var groupButton = utils.el("button", "table-group-button");
    groupButton.type = "button";
    var swatch = utils.el("i", "group-swatch");
    swatch.style.setProperty("--swatch", item.group.color);
    groupButton.append(swatch, utils.el("span", "", item.group.name));
    groupButton.addEventListener("click", function () {
      applyDashboardFilter(item.group.id, false);
    });
    groupCell.appendChild(groupButton);
    row.appendChild(groupCell);
    row.appendChild(utils.el("td", "", item.total));
    row.appendChild(utils.el("td", "", item.completed));
    row.appendChild(utils.el("td", "", item.pending));
    var overdueCell = utils.el("td");
    var overdueButton = utils.el("button", "table-overdue-button", item.overdue);
    overdueButton.type = "button";
    overdueButton.addEventListener("click", function () {
      applyDashboardFilter(item.group.id, true);
    });
    overdueCell.appendChild(overdueButton);
    row.appendChild(overdueCell);
    row.appendChild(utils.el("td", "", item.completionRate + "%"));
    return row;
  }

  function createFlowCard(item) {
    var card = utils.el("article", "group-card flow-card");
    card.style.setProperty("--group-color", item.flow.color);
    card.style.setProperty("--group-soft", utils.rgba(item.flow.color, 0.1));
    card.style.setProperty("--group-progress", item.completionRate + "%");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "查看 Flow " + item.flow.name);
    var head = utils.el("div", "group-card-head");
    var identity = utils.el("div", "group-card-identity");
    identity.append(
      utils.el("span", "group-card-emblem flow-card-emblem", "F"),
      utils.el("div", "group-card-copy")
    );
    identity.lastChild.append(
      utils.el("strong", "", item.flow.name),
      utils.el(
        "small",
        "",
        (item.group ? item.group.name + " · " : "") + item.total + " STEPS"
      )
    );
    var ring = utils.el("span", "group-card-ring");
    ring.appendChild(utils.el("b", "", Math.round(item.completionRate) + "%"));
    head.append(identity, ring);

    var active = Math.max(0, item.pending - item.overdue);
    var progress = utils.el("div", "group-card-stack");
    [
      ["is-completed", item.completed],
      ["is-active", active],
      ["is-overdue", item.overdue]
    ].forEach(function (part) {
      var bar = utils.el("i", part[0]);
      bar.style.width = percentage(part[1], item.total) + "%";
      progress.appendChild(bar);
    });
    var footer = utils.el("div", "group-card-stats");
    footer.append(
      utils.el("span", "completed", "✓ 完成 " + item.completed),
      utils.el("span", "active", "○ 进行 " + active)
    );
    var overdue = utils.el("button", "table-overdue-button overdue", "逾期 " + item.overdue);
    overdue.type = "button";
    overdue.addEventListener("click", function (event) {
      event.stopPropagation();
      applyDashboardFlowFilter(item.flow.id, true);
    });
    footer.appendChild(overdue);
    card.append(head, progress, footer);
    card.addEventListener("click", function () {
      applyDashboardFlowFilter(item.flow.id, false);
    });
    card.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        applyDashboardFlowFilter(item.flow.id, false);
      }
    });
    return card;
  }

  function createFlowTableRow(item) {
    var row = utils.el("tr");
    row.appendChild(utils.el("td", "", item.group ? item.group.name : "未知分组"));
    var flowCell = utils.el("td");
    var flowButton = utils.el("button", "table-group-button");
    flowButton.type = "button";
    var swatch = utils.el("i", "group-swatch");
    swatch.style.setProperty("--swatch", item.flow.color);
    flowButton.append(swatch, utils.el("span", "", item.flow.name));
    flowButton.addEventListener("click", function () {
      applyDashboardFlowFilter(item.flow.id, false);
    });
    flowCell.appendChild(flowButton);
    row.appendChild(flowCell);
    row.appendChild(utils.el("td", "", item.total));
    row.appendChild(utils.el("td", "", item.completed));
    row.appendChild(utils.el("td", "", item.pending));
    var overdueCell = utils.el("td");
    var overdueButton = utils.el("button", "table-overdue-button", item.overdue);
    overdueButton.type = "button";
    overdueButton.addEventListener("click", function () {
      applyDashboardFlowFilter(item.flow.id, true);
    });
    overdueCell.appendChild(overdueButton);
    row.appendChild(overdueCell);
    row.appendChild(utils.el("td", "", item.completionRate + "%"));
    return row;
  }

  function setMaterialFilterLabel(id, count) {
    dom[id].textContent = count ? count + " 项" : "全部";
  }

  function getMaterialLibraryPreferences() {
    data.preferences = storage.normalizePreferences(data.preferences, data.groups);
    return data.preferences.documentLibrary;
  }

  function isMaterialGroupLayout() {
    return getMaterialLibraryPreferences().layout === "group";
  }

  function defaultMaterialGroupOrder() {
    return getSortedGroups()
      .map(function (group) {
        return group.id;
      })
      .concat(MATERIAL_UNGROUPED_KEY);
  }

  function materialGroupMeta(key) {
    if (key === MATERIAL_UNGROUPED_KEY) {
      return {
        key: key,
        name: i18n.isEnglish() ? "Ungrouped" : "未分组",
        color: "#9AA4B7",
        group: null
      };
    }
    var group = getGroup(key);
    return group
      ? { key: key, name: group.name, color: group.color, group: group }
      : null;
  }

  function persistMaterialLibraryPreferences(message) {
    try {
      data = storage.save(data);
      sanitizeUiState();
      renderMaterialLibrary();
      syncView();
      if (message) toast(message);
      return true;
    } catch (error) {
      toast(
        (i18n.isEnglish() ? "Layout preferences could not be saved: " : "布局偏好保存失败：") +
          error.message,
        "error",
        6500
      );
      return false;
    }
  }

  function setMaterialLibraryLayout(layout) {
    var nextLayout = layout === "group" ? "group" : "list";
    var preferences = getMaterialLibraryPreferences();
    if (preferences.layout === nextLayout) return;
    preferences.layout = nextLayout;
    persistMaterialLibraryPreferences(
      i18n.isEnglish()
        ? nextLayout === "group"
          ? "Group layout enabled"
          : "List layout enabled"
        : nextLayout === "group"
          ? "已切换到分组布局"
          : "已切换到列表布局"
    );
  }

  function renderMaterialLibraryLayoutState() {
    var groupLayout = isMaterialGroupLayout();
    queryAll('[data-action="materials-layout-list"]').forEach(function (button) {
      button.classList.toggle("is-active", !groupLayout);
      button.setAttribute("aria-pressed", String(!groupLayout));
    });
    queryAll('[data-action="materials-layout-group"]').forEach(function (button) {
      button.classList.toggle("is-active", groupLayout);
      button.setAttribute("aria-pressed", String(groupLayout));
    });
    dom["material-layout-settings-button"].hidden = !groupLayout;
    dom["materials-table-section"].hidden = groupLayout;
    dom["materials-group-section"].hidden = !groupLayout;
    ["material-group-filter", "material-flow-filter", "material-task-filter"].forEach(
      function (id) {
        dom[id].hidden = groupLayout;
      }
    );
    var scopeToggle = query(".material-scope-toggle", dom["materials-view"]);
    if (scopeToggle) scopeToggle.hidden = groupLayout;
  }

  function renderMaterialLayoutOrder(order) {
    var container = utils.clear(dom["material-layout-order-list"]);
    var requested = Array.isArray(order) ? order : defaultMaterialGroupOrder();
    var validOrder = requested
      .map(materialGroupMeta)
      .filter(Boolean)
      .map(function (meta) {
        return meta.key;
      });
    defaultMaterialGroupOrder().forEach(function (key) {
      if (!validOrder.includes(key)) validOrder.push(key);
    });
    validOrder.forEach(function (key, index) {
      var meta = materialGroupMeta(key);
      if (!meta) return;
      var item = utils.el("div", "material-layout-order-item");
      item.dataset.materialGroupKey = key;
      item.draggable = true;
      item.style.setProperty("--group-color", meta.color);
      var handle = utils.el("span", "material-layout-drag-handle", "⠿");
      handle.title = i18n.isEnglish() ? "Drag to reorder" : "拖动调整顺序";
      handle.setAttribute("aria-hidden", "true");
      var number = utils.el(
        "span",
        "material-layout-order-number",
        String(index + 1).padStart(2, "0")
      );
      number.dataset.materialLayoutOrderNumber = "true";
      var name = utils.el("strong", "", meta.name);
      if (meta.group) name.dataset.userContent = "true";
      var controls = utils.el("span", "material-layout-order-controls");
      var up = utils.el("button", "", "↑");
      up.type = "button";
      up.title = i18n.isEnglish() ? "Move up" : "上移";
      up.disabled = index === 0;
      up.addEventListener("click", function () {
        moveMaterialLayoutOrderItem(item, -1);
      });
      var down = utils.el("button", "", "↓");
      down.type = "button";
      down.title = i18n.isEnglish() ? "Move down" : "下移";
      down.disabled = index === validOrder.length - 1;
      down.addEventListener("click", function () {
        moveMaterialLayoutOrderItem(item, 1);
      });
      controls.append(up, down);
      item.append(handle, number, name, controls);
      item.addEventListener("dragstart", function (event) {
        ui.draggedMaterialGroupKey = key;
        item.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", key);
      });
      item.addEventListener("dragover", function (event) {
        event.preventDefault();
        var dragging = query(".material-layout-order-item.is-dragging", container);
        if (!dragging || dragging === item) return;
        var rect = item.getBoundingClientRect();
        var placeAfter = event.clientY > rect.top + rect.height / 2;
        container.insertBefore(dragging, placeAfter ? item.nextSibling : item);
        refreshMaterialLayoutOrder();
      });
      item.addEventListener("drop", function (event) {
        event.preventDefault();
        refreshMaterialLayoutOrder();
      });
      item.addEventListener("dragend", function () {
        item.classList.remove("is-dragging");
        ui.draggedMaterialGroupKey = null;
        refreshMaterialLayoutOrder();
      });
      container.appendChild(item);
    });
  }

  function moveMaterialLayoutOrderItem(item, direction) {
    var container = dom["material-layout-order-list"];
    if (direction < 0 && item.previousElementSibling) {
      container.insertBefore(item, item.previousElementSibling);
    } else if (direction > 0 && item.nextElementSibling) {
      container.insertBefore(item.nextElementSibling, item);
    }
    refreshMaterialLayoutOrder();
  }

  function refreshMaterialLayoutOrder() {
    var items = queryAll(
      ".material-layout-order-item",
      dom["material-layout-order-list"]
    );
    items.forEach(function (item, index) {
      var number = query("[data-material-layout-order-number]", item);
      if (number) number.textContent = String(index + 1).padStart(2, "0");
      var buttons = queryAll("button", item);
      if (buttons[0]) buttons[0].disabled = index === 0;
      if (buttons[1]) buttons[1].disabled = index === items.length - 1;
    });
  }

  function openMaterialLayoutSettings() {
    var preferences = getMaterialLibraryPreferences();
    dom["material-layout-columns"].value = String(preferences.columns);
    renderMaterialLayoutOrder(preferences.groupOrder);
    dom["material-layout-dialog"].showModal();
  }

  function closeMaterialLayoutSettings() {
    ui.draggedMaterialGroupKey = null;
    dom["material-layout-dialog"].close();
  }

  function resetMaterialLayoutDraft() {
    dom["material-layout-columns"].value = "4";
    renderMaterialLayoutOrder(defaultMaterialGroupOrder());
  }

  function saveMaterialLayoutPreferences(event) {
    event.preventDefault();
    var preferences = getMaterialLibraryPreferences();
    preferences.layout = "group";
    preferences.columns = Math.max(
      1,
      Math.min(4, Number(dom["material-layout-columns"].value) || 4)
    );
    preferences.groupOrder = queryAll(
      ".material-layout-order-item",
      dom["material-layout-order-list"]
    ).map(function (item) {
      return item.dataset.materialGroupKey;
    });
    if (
      persistMaterialLibraryPreferences(
        i18n.isEnglish() ? "Group layout updated" : "分组布局已更新"
      )
    ) {
      closeMaterialLayoutSettings();
    }
  }

  function clearMaterialFilter(key) {
    ui.materialFilters[key] = [];
    renderMaterialLibrary();
  }

  function clearMaterialFilters() {
    ui.materialFilters = {
      name: "",
      types: [],
      taskIds: [],
      flowIds: [],
      groupIds: [],
      recentOnly: false
    };
    renderMaterialLibrary();
    closeDetailsMenus();
    toast("资料库筛选已清空");
  }

  function appendMaterialFilterOption(container, config) {
    var label = utils.el("label", "check-option");
    var checkbox = utils.el("input");
    checkbox.type = "checkbox";
    checkbox.value = config.value;
    checkbox.checked = config.checked;
    checkbox.dataset[config.dataset] = "true";
    label.appendChild(checkbox);
    if (config.color) {
      var swatch = utils.el("i", "group-swatch");
      swatch.style.setProperty("--swatch", config.color);
      label.appendChild(swatch);
    }
    label.appendChild(utils.el("span", "", config.label));
    container.appendChild(label);
  }

  function renderMaterialFilterOptions() {
    var typeContainer = utils.clear(dom["material-filter-types"]);
    var typeColors = {
      document: "#5368d8",
      deliverable: "#258365",
      control: "#b5760d",
      folder: "#7352b8"
    };
    materialTools.TYPES.forEach(function (type) {
      appendMaterialFilterOption(typeContainer, {
        value: type,
        label: materialTools.typeLabel(type),
        checked: ui.materialFilters.types.includes(type),
        dataset: "materialFilterType",
        color: typeColors[type]
      });
    });
    setMaterialFilterLabel("material-filter-type-label", ui.materialFilters.types.length);

    var taskContainer = utils.clear(dom["material-filter-tasks"]);
    data.tasks
      .slice()
      .sort(function (left, right) {
        var leftGroup = getGroup(left.groupId);
        var rightGroup = getGroup(right.groupId);
        return (
          Number((leftGroup && leftGroup.order) || 0) -
            Number((rightGroup && rightGroup.order) || 0) ||
          left.name.localeCompare(right.name, i18n.locale(), { numeric: true })
        );
      })
      .forEach(function (task) {
        var group = getGroup(task.groupId);
        var flow = getFlow(task.flowId);
        appendMaterialFilterOption(taskContainer, {
          value: task.id,
          label: [group && group.name, flow && flow.name, task.name].filter(Boolean).join(" / "),
          checked: ui.materialFilters.taskIds.includes(task.id),
          dataset: "materialFilterTask",
          color: group && group.color
        });
      });
    if (!data.tasks.length) {
      taskContainer.appendChild(utils.el("p", "filter-empty", "暂无 Task"));
    }
    setMaterialFilterLabel("material-filter-task-label", ui.materialFilters.taskIds.length);

    var flowContainer = utils.clear(dom["material-filter-flows"]);
    getSortedFlows().forEach(function (flow) {
      var group = getGroup(flow.groupId);
      appendMaterialFilterOption(flowContainer, {
        value: flow.id,
        label: [group && group.name, flow.name].filter(Boolean).join(" / "),
        checked: ui.materialFilters.flowIds.includes(flow.id),
        dataset: "materialFilterFlow",
        color: flow.color
      });
    });
    if (!data.flows.length) {
      flowContainer.appendChild(utils.el("p", "filter-empty", "暂无 Flow"));
    }
    setMaterialFilterLabel("material-filter-flow-label", ui.materialFilters.flowIds.length);

    var groupContainer = utils.clear(dom["material-filter-groups"]);
    getSortedGroups().forEach(function (group) {
      appendMaterialFilterOption(groupContainer, {
        value: group.id,
        label: group.name,
        checked: ui.materialFilters.groupIds.includes(group.id),
        dataset: "materialFilterGroup",
        color: group.color
      });
    });
    appendMaterialFilterOption(groupContainer, {
      value: "__ungrouped__",
      label: "未分组",
      checked: ui.materialFilters.groupIds.includes("__ungrouped__"),
      dataset: "materialFilterGroup",
      color: "#9aa4b7"
    });
    setMaterialFilterLabel("material-filter-group-label", ui.materialFilters.groupIds.length);
  }

  function materialMatchesFilters(material, groupLayout) {
    var filters = ui.materialFilters;
    var relations = materialTools.resolveRelations(material, data);
    if (
      filters.name &&
      !utils.normalizeText(material.title).includes(utils.normalizeText(filters.name))
    ) {
      return false;
    }
    if (filters.types.length && !filters.types.includes(material.type)) return false;
    if (
      !groupLayout &&
      filters.taskIds.length &&
      !filters.taskIds.some(function (id) {
        return relations.taskIds.includes(id);
      })
    ) {
      return false;
    }
    if (
      !groupLayout &&
      filters.flowIds.length &&
      !filters.flowIds.some(function (id) {
        return relations.flowIds.includes(id);
      })
    ) {
      return false;
    }
    if (!groupLayout && filters.groupIds.length) {
      var groupMatch = filters.groupIds.some(function (id) {
        return id === "__ungrouped__"
          ? relations.groupIds.length === 0
          : relations.groupIds.includes(id);
      });
      if (!groupMatch) return false;
    }
    if (
      !groupLayout &&
      filters.recentOnly &&
      !materialTools.openedInCurrentOrPreviousWeek(material, new Date())
    ) {
      return false;
    }
    return true;
  }

  function appendMaterialChips(cell, items, emptyLabel) {
    var wrap = utils.el("div", "material-chip-list");
    if (!items.length) {
      wrap.appendChild(utils.el("span", "material-chip is-empty", emptyLabel || "—"));
    } else {
      items.forEach(function (item) {
        var chip = utils.el("span", "material-chip", item.label);
        chip.dataset.userContent = "true";
        if (item.color) {
          chip.style.setProperty("--chip-color", item.color);
          chip.classList.add("has-color");
        }
        wrap.appendChild(chip);
      });
    }
    cell.appendChild(wrap);
  }

  function createMaterialTableRow(material) {
    var row = utils.el("tr");
    row.dataset.materialId = material.id;
    var relations = materialTools.resolveRelations(material, data);
    var selectCell = utils.el("td", "material-select-column");
    var select = utils.el("input");
    select.type = "checkbox";
    select.value = material.id;
    select.dataset.materialSelect = "true";
    select.checked = ui.selectedMaterialIds.includes(material.id);
    select.setAttribute("aria-label", "选择资料 " + material.title);
    selectCell.appendChild(select);
    var nameCell = utils.el("td");
    var nameButton = utils.el("button", "material-name-button", material.title);
    nameButton.type = "button";
    nameButton.addEventListener("click", function () {
      openMaterialDialog(material.id);
    });
    nameCell.appendChild(nameButton);

    var urlCell = utils.el("td");
    var urlButton = utils.el("button", "material-url-button", material.url);
    urlButton.type = "button";
    urlButton.title = "打开 " + material.title;
    urlButton.addEventListener("click", function () {
      openMaterialLink(material.id);
    });
    var count = materialTools.currentAndPreviousWeekOpenCount(material, new Date());
    urlCell.append(urlButton, utils.el("small", "", "本周及上周打开 " + count + " 次"));

    var typeCell = utils.el("td");
    typeCell.appendChild(
      utils.el(
        "span",
        "material-type-badge type-" + material.type,
        materialTools.typeLabel(material.type)
      )
    );

    var taskCell = utils.el("td");
    appendMaterialChips(
      taskCell,
      relations.tasks.map(function (task) {
        return { label: task.name };
      }),
      "未关联"
    );
    var flowCell = utils.el("td");
    appendMaterialChips(
      flowCell,
      relations.flows.map(function (flow) {
        return { label: flow.name, color: flow.color };
      }),
      "未关联"
    );
    var groupCell = utils.el("td");
    appendMaterialChips(
      groupCell,
      relations.groups.map(function (group) {
        return { label: group.name, color: group.color };
      }),
      "未分组"
    );

    var noteCell = utils.el("td", "material-note-cell", material.note || "—");
    noteCell.title = material.note || "";
    row.append(
      selectCell,
      nameCell,
      urlCell,
      typeCell,
      taskCell,
      flowCell,
      groupCell,
      noteCell
    );
    return row;
  }

  function createMaterialGroupCard(meta, materials, index) {
    var card = utils.el("article", "material-group-card");
    card.dataset.materialGroupKey = meta.key;
    card.style.setProperty("--group-color", meta.color);

    var header = utils.el("header", "material-group-card-head");
    var headingWrap = utils.el("div", "material-group-card-title");
    var marker = utils.el("i", "material-group-marker");
    marker.setAttribute("aria-hidden", "true");
    var titleCopy = utils.el("div");
    titleCopy.append(
      utils.el(
        "small",
        "",
        (i18n.isEnglish() ? "GROUP " : "分组 ") + String(index + 1).padStart(2, "0")
      ),
      utils.el("h2", "", meta.name)
    );
    if (meta.group) query("h2", titleCopy).dataset.userContent = "true";
    headingWrap.append(marker, titleCopy);
    var count = utils.el(
      "span",
      "material-group-count",
      i18n.isEnglish()
        ? materials.length + (materials.length === 1 ? " document" : " documents")
        : materials.length + " 条资料"
    );
    header.append(headingWrap, count);

    var list = utils.el("div", "material-group-list");
    list.dataset.materialGroupScroll = meta.key;
    if (!materials.length) {
      list.appendChild(
        utils.el(
          "p",
          "material-group-empty",
          i18n.isEnglish() ? "No matching documents" : "暂无符合条件的资料"
        )
      );
    } else {
      materialTools.sortByRecentUsage(materials, new Date()).forEach(function (material) {
        var row = utils.el("div", "material-group-document");
        row.dataset.materialId = material.id;
        var select = utils.el("input");
        select.type = "checkbox";
        select.value = material.id;
        select.dataset.materialSelect = "true";
        select.checked = ui.selectedMaterialIds.includes(material.id);
        select.setAttribute(
          "aria-label",
          (i18n.isEnglish() ? "Select document " : "选择资料 ") + material.title
        );
        var nameButton = utils.el("button", "material-group-name", material.title);
        nameButton.type = "button";
        nameButton.dataset.userContent = "true";
        nameButton.title = material.title;
        nameButton.addEventListener("click", function () {
          openMaterialDialog(material.id);
        });
        var goButton = utils.el(
          "button",
          "material-group-go",
          i18n.isEnglish() ? "Go to" : "前往"
        );
        goButton.type = "button";
        goButton.title =
          (i18n.isEnglish() ? "Open " : "打开 ") + material.title;
        goButton.addEventListener("click", function () {
          openMaterialLink(material.id);
        });
        row.append(select, nameButton, goButton);
        list.appendChild(row);
      });
    }
    card.append(header, list);
    return card;
  }

  function renderMaterialGroupBoard(visibleMaterials) {
    var board = utils.clear(dom["materials-group-board"]);
    var preferences = getMaterialLibraryPreferences();
    board.style.setProperty("--materials-group-columns", preferences.columns);
    var grouped = new Map();
    preferences.groupOrder.forEach(function (key) {
      grouped.set(key, []);
    });
    visibleMaterials.forEach(function (material) {
      var groupIds = materialTools.resolveRelations(material, data).groupIds;
      if (!groupIds.length) {
        if (grouped.has(MATERIAL_UNGROUPED_KEY)) {
          grouped.get(MATERIAL_UNGROUPED_KEY).push(material);
        }
        return;
      }
      groupIds.forEach(function (groupId) {
        if (grouped.has(groupId)) grouped.get(groupId).push(material);
      });
    });
    preferences.groupOrder.forEach(function (key, index) {
      var meta = materialGroupMeta(key);
      if (!meta) return;
      board.appendChild(createMaterialGroupCard(meta, grouped.get(key) || [], index));
    });
  }

  function getVisibleMaterials() {
    var groupLayout = isMaterialGroupLayout();
    var filtered = data.materials.filter(function (material) {
      return materialMatchesFilters(material, groupLayout);
    });
    return groupLayout
      ? materialTools.sortByRecentUsage(filtered, new Date())
      : materialTools.sortByGroup(filtered, data);
  }

  function handleMaterialSelectionChange(event) {
    if (!event.target.matches("[data-material-select]")) return;
    var id = event.target.value;
    if (event.target.checked && !ui.selectedMaterialIds.includes(id)) {
      ui.selectedMaterialIds.push(id);
    } else if (!event.target.checked) {
      ui.selectedMaterialIds = ui.selectedMaterialIds.filter(function (selectedId) {
        return selectedId !== id;
      });
    }
    syncMaterialSelectionState();
  }

  function syncMaterialSelectionState(visibleIds) {
    var ids = Array.isArray(visibleIds)
      ? visibleIds
      : getVisibleMaterials().map(function (material) {
          return material.id;
        });
    var selectedIds = new Set(ui.selectedMaterialIds);
    var selectedVisibleCount = ids.filter(function (id) {
      return selectedIds.has(id);
    }).length;
    dom["material-selection-count"].textContent =
      "已选 " + ui.selectedMaterialIds.length + " 条";
    var deleteButton = query('[data-action="delete-selected-materials"]');
    if (deleteButton) deleteButton.disabled = ui.selectedMaterialIds.length === 0;
    dom["material-select-visible"].checked =
      ids.length > 0 && selectedVisibleCount === ids.length;
    dom["material-select-visible"].indeterminate =
      selectedVisibleCount > 0 && selectedVisibleCount < ids.length;
    queryAll("[data-material-select]", dom["materials-view"]).forEach(
      function (checkbox) {
        checkbox.checked = selectedIds.has(checkbox.value);
      }
    );
  }

  function renderMaterialLibrary() {
    dom["material-filter-name"].value = ui.materialFilters.name;
    renderMaterialFilterOptions();
    renderMaterialLibraryLayoutState();

    var frequentCount = data.materials.filter(function (material) {
      return materialTools.openedInCurrentOrPreviousWeek(material, new Date());
    }).length;
    var ungroupedCount = data.materials.filter(function (material) {
      return materialTools.resolveRelations(material, data).groupIds.length === 0;
    }).length;
    dom["materials-total"].textContent = data.materials.length;
    dom["materials-frequent-total"].textContent = frequentCount;
    dom["materials-ungrouped-total"].textContent = ungroupedCount;

    queryAll('[data-action="materials-all"]').forEach(function (button) {
      button.classList.toggle("is-active", !ui.materialFilters.recentOnly);
    });
    queryAll('[data-action="materials-recent"]').forEach(function (button) {
      button.classList.toggle("is-active", ui.materialFilters.recentOnly);
    });

    var visible = getVisibleMaterials();
    var visibleIds = visible.map(function (material) {
      return material.id;
    });
    syncMaterialSelectionState(visibleIds);
    dom["materials-result-count"].textContent =
      "显示 " + visible.length + " / " + data.materials.length + " 条资料";
    var body = utils.clear(dom["materials-table-body"]);
    if (!visible.length) {
      var emptyRow = utils.el("tr");
      var emptyCell = utils.el(
        "td",
        "materials-empty-cell",
        i18n.isEnglish()
          ? data.materials.length
            ? "No documents match the current filters."
            : "No documents yet. Add one manually or upload a file."
          : data.materials.length
            ? "没有符合当前筛选条件的资料。"
            : "还没有资料，可手动添加或上传。"
      );
      emptyCell.colSpan = 8;
      emptyRow.appendChild(emptyCell);
      body.appendChild(emptyRow);
    } else {
      visible.forEach(function (material) {
        body.appendChild(createMaterialTableRow(material));
      });
    }
    if (isMaterialGroupLayout()) renderMaterialGroupBoard(visible);
    else utils.clear(dom["materials-group-board"]);
  }

  function setVisibleMaterialsSelected(selected) {
    var visibleIds = getVisibleMaterials().map(function (material) {
      return material.id;
    });
    if (selected) {
      ui.selectedMaterialIds = materialTools.uniqueIds(
        ui.selectedMaterialIds.concat(visibleIds)
      );
    } else {
      ui.selectedMaterialIds = ui.selectedMaterialIds.filter(function (id) {
        return !visibleIds.includes(id);
      });
    }
    syncMaterialSelectionState(visibleIds);
  }

  function deleteSelectedMaterials() {
    var ids = ui.selectedMaterialIds.slice();
    if (!ids.length) return;
    if (
      !confirmAction(
        "确认删除选中的 " + ids.length + " 条资料？它们会从所有相关 Task 中同步移除。"
      )
    ) {
      return;
    }
    if (!confirmAction("再次确认：批量删除资料不可恢复，是否继续？")) return;
    var idSet = new Set(ids);
    data.materials = data.materials.filter(function (material) {
      return !idSet.has(material.id);
    });
    ui.selectedMaterialIds = [];
    persistAndRender("已删除 " + ids.length + " 条资料");
  }

  function openMaterialLink(materialId) {
    var material = getMaterial(materialId);
    if (!material || !utils.isValidUrl(material.url)) {
      toast("资料链接无效，无法打开。", "error");
      return;
    }
    var groupScrolls = captureMaterialGroupScrolls();
    materialTools.recordOpen(material, new Date());
    try {
      data = storage.save(data);
      renderMaterialLibrary();
      restoreMaterialGroupScrolls(groupScrolls);
    } catch (error) {
      toast("打开次数保存失败：" + error.message, "warning", 5500);
    }
    utils.safeOpen(material.url);
  }

  function captureMaterialGroupScrolls() {
    var positions = {};
    queryAll("[data-material-group-scroll]", dom["materials-group-board"]).forEach(
      function (list) {
        positions[list.dataset.materialGroupScroll] = list.scrollTop;
      }
    );
    return positions;
  }

  function restoreMaterialGroupScrolls(positions) {
    if (!positions || !isMaterialGroupLayout()) return;
    function restore() {
      queryAll("[data-material-group-scroll]", dom["materials-group-board"]).forEach(
        function (list) {
          if (Object.prototype.hasOwnProperty.call(positions, list.dataset.materialGroupScroll)) {
            list.scrollTop = positions[list.dataset.materialGroupScroll];
          }
        }
      );
    }
    restore();
    window.requestAnimationFrame(restore);
  }

  function applyDashboardFilter(groupId, overdueOnly) {
    ui.filters = {
      search: "",
      groupIds: groupId ? [groupId] : [],
      flowId: "all",
      status: "all",
      urgency: "all",
      overdueOnly: Boolean(overdueOnly)
    };
    switchView("timeline");
    renderFilteredViews();
  }

  function applyDashboardFlowFilter(flowId, overdueOnly) {
    var flow = getFlow(flowId);
    if (!flow) return;
    ui.filters = {
      search: "",
      groupIds: [flow.groupId],
      flowId: flow.id,
      status: "all",
      urgency: "all",
      overdueOnly: Boolean(overdueOnly)
    };
    switchView("timeline");
    renderFilteredViews();
  }

  function switchView(view) {
    var nextView = ["home", "timeline", "dashboard", "materials", "notes"].includes(view)
      ? view
      : "home";
    if (
      ui.view === "notes" &&
      nextView !== "notes" &&
      ui.noteDirty &&
      !confirmAction("当前笔记尚未保存，离开后修改会丢失。仍要继续吗？")
    ) {
      return;
    }
    if (ui.view === "notes" && nextView !== "notes") {
      ui.noteDirty = false;
      ui.noteIsNew = false;
    }
    var resetDayTimeline =
      nextView === "timeline" &&
      ui.view !== "timeline" &&
      ui.timelineGranularity === "day";
    if (nextView === "dashboard" && ui.view !== "dashboard") {
      ui.dashboardModule = null;
    }
    if (resetDayTimeline) {
      ui.timelineGranularity = "week";
      ui.timelineDayAnchor = ui.timelineAnchor;
      ui.weekTimelineViewport = null;
      renderTimeline();
    }
    ui.view = nextView;
    syncView();
    if (ui.view === "dashboard") syncDashboardModuleView();
    if (ui.view === "timeline") requestAnimationFrame(scrollToCurrentWeek);
  }

  function syncView() {
    dom["home-view"].hidden = ui.view !== "home";
    dom["timeline-view"].hidden = ui.view !== "timeline";
    dom["dashboard-view"].hidden = ui.view !== "dashboard";
    dom["materials-view"].hidden = ui.view !== "materials";
    dom["notes-view"].hidden = ui.view !== "notes";
    dom["filter-bar"].hidden = ui.view !== "timeline";
    dom["materials-filter-bar"].hidden = ui.view !== "materials";
    dom["materials-layout-controls"].hidden = ui.view !== "materials";
    var simplifiedHeader =
      ui.view === "dashboard" || ui.view === "materials" || ui.view === "notes";
    dom["header-summary"].hidden = simplifiedHeader;
    dom["header-actions"].hidden = simplifiedHeader;
    queryAll("[data-view]").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.view === ui.view);
      button.setAttribute("aria-current", button.dataset.view === ui.view ? "page" : "false");
    });
  }

  function clearFieldErrors(form) {
    queryAll(".is-invalid", form).forEach(function (field) {
      field.classList.remove("is-invalid");
    });
    queryAll(".field-error", form).forEach(function (error) {
      error.textContent = "";
    });
  }

  function setFieldError(fieldId, message) {
    var field = document.getElementById(fieldId);
    var error = query('[data-error-for="' + fieldId + '"]');
    if (field) field.classList.add("is-invalid");
    if (error) error.textContent = i18n.translateMessage(message);
  }

  function colorPaletteLabel(mode, color) {
    var prefix = i18n.isEnglish()
      ? mode === "highlight" ? "Highlight" : "Text color"
      : mode === "highlight" ? "高亮颜色" : "字色";
    return prefix + "：" + (i18n.isEnglish() ? color[2] : color[1]);
  }

  function renderPresetColorPalettes() {
    queryAll("[data-color-palette]").forEach(function (container) {
      var mode = container.dataset.colorMode === "highlight" ? "highlight" : "text";
      var colors = RICH_TEXT_COLOR_PALETTES[mode];
      var fragment = document.createDocumentFragment();
      container.setAttribute(
        "aria-label",
        i18n.isEnglish()
          ? mode === "highlight" ? "Highlight color presets" : "Text color presets"
          : mode === "highlight" ? "高亮颜色预设" : "字色预设"
      );
      colors.forEach(function (color, index) {
        var swatch = utils.el("button", "preset-color-swatch");
        swatch.type = "button";
        swatch.dataset.action = "apply-preset-color";
        swatch.dataset.editor = container.dataset.editor;
        swatch.dataset.colorMode = mode;
        swatch.dataset.colorValue = color[0];
        swatch.style.setProperty("--swatch-color", color[0]);
        swatch.title = colorPaletteLabel(mode, color);
        swatch.setAttribute("aria-label", colorPaletteLabel(mode, color));
        swatch.setAttribute("role", "menuitemradio");
        swatch.setAttribute("aria-checked", String(index === 0));
        swatch.classList.toggle("is-selected", index === 0);
        fragment.appendChild(swatch);
      });
      container.replaceChildren(fragment);
    });
  }

  function closePresetColorPalettes(exceptPicker) {
    queryAll("[data-color-picker]").forEach(function (picker) {
      if (picker === exceptPicker) return;
      var popover = query("[data-color-palette]", picker);
      var trigger = query('[data-action="toggle-color-palette"]', picker);
      if (popover) popover.hidden = true;
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  }

  function togglePresetColorPalette(trigger) {
    var picker = trigger && trigger.closest("[data-color-picker]");
    var popover = picker && query("[data-color-palette]", picker);
    if (!picker || !popover) return;
    var opening = popover.hidden;
    closePresetColorPalettes(picker);
    popover.hidden = !opening;
    trigger.setAttribute("aria-expanded", String(opening));
    if (opening) {
      var selected = query(".preset-color-swatch.is-selected", popover);
      setTimeout(function () {
        var target = selected || query(".preset-color-swatch", popover);
        if (target) target.focus();
      }, 0);
    }
  }

  function applyPresetColor(swatch) {
    var editor = dom[swatch.dataset.editor];
    var mode = swatch.dataset.colorMode;
    var value = swatch.dataset.colorValue;
    if (!editor || !value) return;
    executeRichTextCommand(mode === "highlight" ? "hiliteColor" : "foreColor", value, editor);
    var picker = swatch.closest("[data-color-picker]");
    queryAll(".preset-color-swatch", picker).forEach(function (item) {
      var selected = item === swatch;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-checked", String(selected));
    });
    var preview = query("[data-color-preview]", picker);
    if (preview) preview.style.setProperty("--swatch-color", value);
    closePresetColorPalettes();
    editor.focus();
  }

  function normalizeExecutedFontSize(editor, pixelSize) {
    queryAll('font[size="7"]', editor).forEach(function (font) {
      var span = document.createElement("span");
      span.style.fontSize = pixelSize + "px";
      var color = font.getAttribute("color");
      if (color) span.style.color = color;
      while (font.firstChild) span.appendChild(font.firstChild);
      font.replaceWith(span);
    });
  }

  function applyPresetFontSize(control) {
    var editor = dom[control.dataset.editor];
    var size = Number(control.value);
    if (!editor || !RICH_TEXT_FONT_SIZES.includes(size)) return;
    executeRichTextCommand("fontSize", String(size), editor);
    control.value = "";
    closePresetColorPalettes();
    editor.focus();
  }

  function selectionRangeInsideEditor(editor, selection) {
    if (!editor || !selection || !selection.rangeCount) return null;
    var range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) return range.cloneRange();
    try {
      if (!range.intersectsNode(editor)) return null;
    } catch (_error) {
      return null;
    }
    var clipped = range.cloneRange();
    if (!editor.contains(clipped.startContainer)) clipped.setStart(editor, 0);
    if (!editor.contains(clipped.endContainer)) {
      clipped.setEnd(editor, editor.childNodes.length);
    }
    return clipped;
  }

  function rememberRichTextSelection(event) {
    var editor = event && event.currentTarget;
    var selection = window.getSelection && window.getSelection();
    if (!editor || !selection || !selection.rangeCount) return;
    var range = selectionRangeInsideEditor(editor, selection);
    if (!range) return;
    ui.richTextSelection = { editorId: editor.id, range: range };
    if (
      editor === dom["note-editor"] &&
      !event.skipTableSync &&
      !ui.noteTableSuppressRangeSync &&
      !(event.type === "keyup" && event.key === "Shift" && noteTableRegion())
    ) {
      syncNoteTableSelectionFromRange();
    }
  }

  function suppressNoteTableRangeSyncForGesture() {
    ui.noteTableSuppressRangeSync = true;
    if (ui.noteTableRangeSyncTimer) window.clearTimeout(ui.noteTableRangeSyncTimer);
    ui.noteTableRangeSyncTimer = window.setTimeout(function () {
      ui.noteTableSuppressRangeSync = false;
      ui.noteTableRangeSyncTimer = null;
    }, 0);
  }

  function preserveRichTextSelectionBeforeToolbarAction(event) {
    if (event.button !== 0) return;
    var control = event.target.closest(".rich-text-toolbar [data-editor]");
    if (!control) return;
    var editor = dom[control.dataset.editor];
    if (editor) {
      rememberRichTextSelection({
        currentTarget: editor,
        skipTableSync: Boolean(control.closest("[data-table-tool]"))
      });
    }
  }

  function restoreRichTextSelection(editor) {
    if (!editor) return;
    editor.focus();
    var saved = ui.richTextSelection;
    if (!saved || saved.editorId !== editor.id || !saved.range) return;
    var selection = window.getSelection && window.getSelection();
    if (!selection) return;
    try {
      selection.removeAllRanges();
      selection.addRange(saved.range);
    } catch (_error) {
      /* 编辑区内容变化后使用浏览器默认光标位置。 */
    }
  }

  function executeRichTextCommand(command, value, editor) {
    if (!editor || !command) return;
    restoreRichTextSelection(editor);
    var applied = false;
    try {
      if (command === "fontSize") {
        var fontSize = Number(value);
        if (!RICH_TEXT_FONT_SIZES.includes(fontSize)) return;
        applied = document.execCommand("fontSize", false, "7");
        if (applied) normalizeExecutedFontSize(editor, fontSize);
      } else {
        applied = document.execCommand(command, false, value || null);
      }
      if (!applied && command === "hiliteColor") {
        applied = document.execCommand("backColor", false, value || "#FFF1A8");
      }
    } catch (_error) {
      applied = false;
    }
    if (!applied && command !== "removeFormat") {
      toast(i18n.isEnglish() ? "This text format is not supported by the current browser." : "当前浏览器不支持该文字格式。", "warning");
    }
    if (editor === dom["note-editor"]) markNoteDirty();
    if (editor === dom["progress-note"]) {
      ui.progressDirty = true;
      updateProgressCharacterCount();
    }
    rememberRichTextSelection({ currentTarget: editor });
  }

  function renderNoteTableSizePicker() {
    var grid = dom["note-table-size-grid"];
    if (!grid) return;
    var fragment = document.createDocumentFragment();
    for (var row = 1; row <= 8; row += 1) {
      for (var column = 1; column <= 10; column += 1) {
        var cell = utils.el("button", "note-table-size-cell");
        cell.type = "button";
        cell.dataset.action = "insert-note-table";
        cell.dataset.editor = "note-editor";
        cell.dataset.rows = String(row);
        cell.dataset.columns = String(column);
        cell.setAttribute("role", "gridcell");
        cell.setAttribute(
          "aria-label",
          i18n.isEnglish()
            ? row + " rows by " + column + " columns"
            : row + " 行 × " + column + " 列"
        );
        cell.addEventListener("mouseenter", previewNoteTableSize);
        cell.addEventListener("focus", previewNoteTableSize);
        fragment.appendChild(cell);
      }
    }
    grid.replaceChildren(fragment);
    grid.addEventListener("mouseleave", function () {
      previewNoteTableSize(null, 1, 1);
    });
    previewNoteTableSize(null, 1, 1);
  }

  function previewNoteTableSize(event, forcedRows, forcedColumns) {
    var target = event && event.currentTarget;
    var rows = forcedRows || Number(target && target.dataset.rows) || 1;
    var columns = forcedColumns || Number(target && target.dataset.columns) || 1;
    queryAll(".note-table-size-cell", dom["note-table-size-grid"]).forEach(function (cell) {
      cell.classList.toggle(
        "is-preview",
        Number(cell.dataset.rows) <= rows && Number(cell.dataset.columns) <= columns
      );
    });
    dom["note-table-size-label"].textContent = rows + " × " + columns;
  }

  function closeNoteTableMenu(exceptTool) {
    queryAll("[data-table-tool]").forEach(function (tool) {
      if (tool === exceptTool) return;
      var menu = query(".note-table-menu", tool);
      var trigger = query('[data-action="toggle-note-table-menu"]', tool);
      if (menu) {
        menu.hidden = true;
        closeNoteTableSubmenus(menu);
      }
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  }

  function closeNoteTableSubmenus(menu, exceptName) {
    if (!menu) return;
    queryAll("[data-table-submenu-target]", menu).forEach(function (trigger) {
      var name = trigger.dataset.tableSubmenuTarget;
      var panel = dom[name === "create" ? "note-table-create-submenu" : "note-table-edit-submenu"];
      if (name === exceptName) return;
      trigger.setAttribute("aria-expanded", "false");
      if (panel) {
        panel.hidden = true;
        panel.classList.remove("is-open-left");
      }
    });
  }

  function positionNoteTableSubmenu(panel) {
    if (!panel || panel.hidden) return;
    panel.classList.remove("is-open-left");
    var bounds = panel.getBoundingClientRect();
    if (bounds.right > window.innerWidth - 12) panel.classList.add("is-open-left");
  }

  function openNoteTableSubmenu(name, trigger) {
    if (name !== "create" && name !== "edit") return;
    var menu = dom["note-table-menu"];
    var panel = dom[name === "create" ? "note-table-create-submenu" : "note-table-edit-submenu"];
    trigger = trigger || query('[data-table-submenu-target="' + name + '"]', menu);
    if (!menu || menu.hidden || !panel || !trigger) return;
    closeNoteTableSubmenus(menu, name);
    queryAll("[data-table-submenu-target]", menu).forEach(function (item) {
      item.setAttribute("aria-expanded", String(item === trigger));
    });
    panel.hidden = false;
    positionNoteTableSubmenu(panel);
    if (name === "edit") updateNoteTableEditControls();
  }

  function handleNoteTableSubmenuIntent(event) {
    var trigger = event.target.closest("[data-table-submenu-target]");
    if (!trigger || !dom["note-table-menu"].contains(trigger)) return;
    openNoteTableSubmenu(trigger.dataset.tableSubmenuTarget, trigger);
  }

  function toggleNoteTableMenu(trigger) {
    var tool = trigger && trigger.closest("[data-table-tool]");
    var menu = tool && query(".note-table-menu", tool);
    if (!tool || !menu) return;
    var opening = menu.hidden;
    closePresetColorPalettes();
    closeNoteTableMenu(tool);
    menu.hidden = !opening;
    trigger.setAttribute("aria-expanded", String(opening));
    if (opening) {
      if (!noteTableRegion()) syncNoteTableSelectionFromRange();
      updateNoteTableEditControls();
    } else {
      closeNoteTableSubmenus(menu);
    }
  }

  function closestTableCell(node) {
    var element = node && node.nodeType === 1 ? node : node && node.parentElement;
    var cell = element && element.closest ? element.closest("td, th") : null;
    return cell && dom["note-editor"].contains(cell) ? cell : null;
  }

  function buildTableModel(table) {
    var rows = Array.prototype.slice.call(table && table.rows ? table.rows : []);
    var grid = [];
    var infoByCell = new Map();
    var width = 0;
    rows.forEach(function (row, rowIndex) {
      grid[rowIndex] = grid[rowIndex] || [];
      var columnIndex = 0;
      Array.prototype.slice.call(row.cells || []).forEach(function (cell) {
        while (grid[rowIndex][columnIndex]) columnIndex += 1;
        var rowSpan = richText.normalizeTableSpan(cell.getAttribute("rowspan"));
        var colSpan = richText.normalizeTableSpan(cell.getAttribute("colspan"));
        var info = {
          cell: cell,
          row: rowIndex,
          column: columnIndex,
          rowSpan: rowSpan,
          colSpan: colSpan
        };
        infoByCell.set(cell, info);
        for (var rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
          var gridRow = rowIndex + rowOffset;
          grid[gridRow] = grid[gridRow] || [];
          for (var columnOffset = 0; columnOffset < colSpan; columnOffset += 1) {
            grid[gridRow][columnIndex + columnOffset] = info;
          }
        }
        columnIndex += colSpan;
        width = Math.max(width, columnIndex);
      });
    });
    return { table: table, rows: rows, grid: grid, width: width, infoByCell: infoByCell };
  }

  function tableRegionBetweenCells(anchor, focus, table) {
    if (!anchor || !focus || !table || table !== anchor.closest("table") || table !== focus.closest("table")) {
      return null;
    }
    var model = buildTableModel(table);
    var anchorInfo = model.infoByCell.get(anchor);
    var focusInfo = model.infoByCell.get(focus);
    if (!anchorInfo || !focusInfo) return null;
    var minRow = Math.min(anchorInfo.row, focusInfo.row);
    var maxRow = Math.max(
      anchorInfo.row + anchorInfo.rowSpan - 1,
      focusInfo.row + focusInfo.rowSpan - 1
    );
    var minColumn = Math.min(anchorInfo.column, focusInfo.column);
    var maxColumn = Math.max(
      anchorInfo.column + anchorInfo.colSpan - 1,
      focusInfo.column + focusInfo.colSpan - 1
    );
    var cells = [];
    var seen = new Set();
    for (var row = minRow; row <= maxRow; row += 1) {
      for (var column = minColumn; column <= maxColumn; column += 1) {
        var info = model.grid[row] && model.grid[row][column];
        if (info && !seen.has(info.cell)) {
          seen.add(info.cell);
          cells.push(info.cell);
        }
      }
    }
    cells.sort(function (left, right) {
      var leftInfo = model.infoByCell.get(left);
      var rightInfo = model.infoByCell.get(right);
      return leftInfo.row - rightInfo.row || leftInfo.column - rightInfo.column;
    });
    return {
      table: table,
      model: model,
      cells: cells,
      minRow: minRow,
      maxRow: maxRow,
      minColumn: minColumn,
      maxColumn: maxColumn
    };
  }

  function noteTableRegion() {
    var anchor = ui.noteTableAnchorCell;
    var focus = ui.noteTableFocusCell || anchor;
    if (!anchor || !anchor.isConnected || !focus || !focus.isConnected) return null;
    var table = anchor.closest("table");
    if (!table || table !== focus.closest("table") || !dom["note-editor"].contains(table)) return null;
    return tableRegionBetweenCells(anchor, focus, table);
  }

  function renderNoteTableSelection() {
    queryAll(".is-table-active, .is-table-selected", dom["note-editor"]).forEach(function (cell) {
      cell.classList.remove("is-table-active", "is-table-selected");
    });
    queryAll("table.has-table-selection", dom["note-editor"]).forEach(function (table) {
      table.classList.remove("has-table-selection");
    });
    var region = noteTableRegion();
    if (!region) {
      updateNoteTableEditControls();
      updateNoteTableHandleSelectionState();
      return;
    }
    region.table.classList.add("has-table-selection");
    region.cells.forEach(function (cell) {
      cell.classList.add("is-table-selected");
    });
    if (ui.noteTableFocusCell) ui.noteTableFocusCell.classList.add("is-table-active");
    updateNoteTableEditControls();
    updateNoteTableHandleSelectionState();
  }

  function clearNoteTableSelection() {
    ui.noteTableAnchorCell = null;
    ui.noteTableFocusCell = null;
    ui.noteTablePointerAnchorCell = null;
    ui.noteTableDragSelecting = false;
    queryAll(".is-table-active, .is-table-selected", dom["note-editor"]).forEach(function (cell) {
      cell.classList.remove("is-table-active", "is-table-selected");
    });
    queryAll("table.has-table-selection", dom["note-editor"]).forEach(function (table) {
      table.classList.remove("has-table-selection");
    });
    updateNoteTableEditControls();
    updateNoteTableHandleSelectionState();
  }

  function noteTableRegionIsWholeTable(region) {
    return Boolean(
      region &&
      region.minRow === 0 &&
      region.minColumn === 0 &&
      region.maxRow === region.model.grid.length - 1 &&
      region.maxColumn === region.model.width - 1 &&
      region.cells.length === region.model.infoByCell.size
    );
  }

  function updateNoteTableHandleSelectionState() {
    var handle = dom["note-table-select-handle"];
    if (!handle) return;
    var region = noteTableRegion();
    handle.classList.toggle(
      "is-selected",
      Boolean(region && ui.noteTableHoveredTable === region.table && noteTableRegionIsWholeTable(region))
    );
  }

  function updateNoteTableEditControls() {
    var region = noteTableRegion();
    queryAll('[data-action="edit-note-table"]', dom["note-table-menu"]).forEach(function (button) {
      button.disabled = !region ||
        (button.dataset.tableOperation === "merge-cells" && region.cells.length < 2);
    });
    if (dom["note-table-edit-help"]) {
      dom["note-table-edit-help"].textContent = region
        ? i18n.isEnglish()
          ? "Selected " +
            (region.maxRow - region.minRow + 1) + " row(s) × " +
            (region.maxColumn - region.minColumn + 1) + " column(s) (" +
            region.cells.length + " cell(s))."
          : "已选择 " +
            (region.maxRow - region.minRow + 1) + " 行 × " +
            (region.maxColumn - region.minColumn + 1) + " 列（" +
            region.cells.length + " 个单元格）。"
        : i18n.isEnglish()
          ? "Drag across cells, or click one cell and Shift-click another, to select a rectangular range."
          : "点击并拖过单元格，或先点击一个格子再按住 Shift 点击另一个格子，即可选择矩形区域。";
    }
  }

  function syncNoteTableSelectionFromRange() {
    var selection = window.getSelection && window.getSelection();
    if (!selection || !selection.rangeCount) return;
    var range = selectionRangeInsideEditor(dom["note-editor"], selection);
    if (!range) return;
    var intersecting = queryAll("td, th", dom["note-editor"]).filter(function (cell) {
      try {
        return range.intersectsNode(cell);
      } catch (_error) {
        return false;
      }
    });
    var anchorCell = closestTableCell(selection.anchorNode) || closestTableCell(range.startContainer);
    var focusCell = closestTableCell(selection.focusNode) || closestTableCell(range.endContainer);
    if (!anchorCell && intersecting.length) anchorCell = intersecting[0];
    if (!focusCell && intersecting.length) focusCell = intersecting[intersecting.length - 1];
    if (
      !anchorCell ||
      !focusCell ||
      anchorCell.closest("table") !== focusCell.closest("table")
    ) {
      return;
    }
    ui.noteTableAnchorCell = anchorCell;
    ui.noteTableFocusCell = focusCell;
    renderNoteTableSelection();
    var region = noteTableRegion();
    if (region && region.cells.length > 1) collapseNativeTableTextSelection(focusCell);
  }

  function collapseNativeTableTextSelection(cell) {
    if (!cell || !cell.isConnected || !dom["note-editor"].contains(cell)) return;
    try {
      dom["note-editor"].focus({ preventScroll: true });
    } catch (_error) {
      dom["note-editor"].focus();
    }
    var range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(false);
    var selection = window.getSelection && window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
    ui.richTextSelection = { editorId: "note-editor", range: range.cloneRange() };
  }

  function handleNoteEditorTableMouseDown(event) {
    if (event.button !== 0) return;
    var cell = event.target.closest("td, th");
    if (!cell || !dom["note-editor"].contains(cell)) {
      ui.noteTablePointerAnchorCell = null;
      return;
    }
    cancelNoteTableHandleHide();
    showNoteTableSelectHandle(cell.closest("table"));
    ui.noteTablePointerAnchorCell = cell;
    ui.noteTableDragSelecting = false;
    if (
      event.shiftKey &&
      ui.noteTableAnchorCell &&
      ui.noteTableAnchorCell.isConnected &&
      ui.noteTableAnchorCell.closest("table") === cell.closest("table")
    ) {
      event.preventDefault();
      ui.noteTableFocusCell = cell;
      suppressNoteTableRangeSyncForGesture();
      renderNoteTableSelection();
      collapseNativeTableTextSelection(cell);
      return;
    }
    ui.noteTableAnchorCell = cell;
    ui.noteTableFocusCell = cell;
    renderNoteTableSelection();
  }

  function handleNoteEditorTableMouseMove(event) {
    var table = event.target.closest("table");
    if (table && dom["note-editor"].contains(table)) {
      cancelNoteTableHandleHide();
      showNoteTableSelectHandle(table);
    } else {
      scheduleNoteTableHandleHide();
    }
    if (!(event.buttons & 1) || !ui.noteTablePointerAnchorCell) return;
    var cell = event.target.closest("td, th");
    if (
      !cell ||
      cell === ui.noteTablePointerAnchorCell ||
      cell.closest("table") !== ui.noteTablePointerAnchorCell.closest("table")
    ) {
      return;
    }
    event.preventDefault();
    ui.noteTableDragSelecting = true;
    ui.noteTableAnchorCell = ui.noteTablePointerAnchorCell;
    ui.noteTableFocusCell = cell;
    suppressNoteTableRangeSyncForGesture();
    renderNoteTableSelection();
  }

  function handleNoteEditorTableMouseUp(event) {
    if (!ui.noteTableDragSelecting) return;
    event.preventDefault();
    ui.noteTableDragSelecting = false;
    ui.noteTableDragSelectionJustFinished = true;
    suppressNoteTableRangeSyncForGesture();
    collapseNativeTableTextSelection(ui.noteTableFocusCell);
    window.setTimeout(function () {
      ui.noteTableDragSelectionJustFinished = false;
    }, 0);
  }

  function handleNoteEditorTableClick(event) {
    if (ui.noteTableDragSelectionJustFinished) return;
    var cell = event.target.closest("td, th");
    if (!cell || !dom["note-editor"].contains(cell)) {
      clearNoteTableSelection();
      return;
    }
    if (
      !event.shiftKey ||
      !ui.noteTableAnchorCell ||
      !ui.noteTableAnchorCell.isConnected ||
      ui.noteTableAnchorCell.closest("table") !== cell.closest("table")
    ) {
      ui.noteTableAnchorCell = cell;
    }
    ui.noteTableFocusCell = cell;
    renderNoteTableSelection();
    if (event.shiftKey && noteTableRegion().cells.length > 1) {
      collapseNativeTableTextSelection(cell);
    }
  }

  function cancelNoteTableHandleHide() {
    if (ui.noteTableHandleHideTimer) window.clearTimeout(ui.noteTableHandleHideTimer);
    ui.noteTableHandleHideTimer = null;
  }

  function scheduleNoteTableHandleHide() {
    cancelNoteTableHandleHide();
    ui.noteTableHandleHideTimer = window.setTimeout(function () {
      hideNoteTableSelectHandle();
    }, 140);
  }

  function hideNoteTableSelectHandle() {
    cancelNoteTableHandleHide();
    var handle = dom["note-table-select-handle"];
    if (handle) handle.hidden = true;
    ui.noteTableHoveredTable = null;
    updateNoteTableHandleSelectionState();
  }

  function refreshNoteTableSelectHandle() {
    var table = ui.noteTableHoveredTable;
    var handle = dom["note-table-select-handle"];
    var wrapper = handle && handle.parentElement;
    if (!table || !table.isConnected || !handle || !wrapper) {
      if (handle) handle.hidden = true;
      return;
    }
    var editorBounds = dom["note-editor"].getBoundingClientRect();
    var tableBounds = table.getBoundingClientRect();
    if (tableBounds.bottom < editorBounds.top || tableBounds.top > editorBounds.bottom) {
      handle.hidden = true;
      return;
    }
    handle.hidden = false;
    var wrapperBounds = wrapper.getBoundingClientRect();
    var left = Math.max(-20, tableBounds.left - wrapperBounds.left - handle.offsetWidth - 4);
    var top = Math.max(
      3,
      Math.min(
        tableBounds.top - wrapperBounds.top + 4,
        wrapper.clientHeight - handle.offsetHeight - 3
      )
    );
    handle.style.left = Math.round(left) + "px";
    handle.style.top = Math.round(top) + "px";
    updateNoteTableHandleSelectionState();
  }

  function showNoteTableSelectHandle(table) {
    if (!table || !dom["note-editor"].contains(table)) return;
    ui.noteTableHoveredTable = table;
    cancelNoteTableHandleHide();
    refreshNoteTableSelectHandle();
  }

  function selectWholeHoveredNoteTable() {
    var table = ui.noteTableHoveredTable;
    if (!table || !table.isConnected || !dom["note-editor"].contains(table)) return;
    var model = buildTableModel(table);
    var lastRow = model.grid.length - 1;
    var anchorInfo = model.grid[0] && model.grid[0][0];
    var focusInfo = model.grid[lastRow] && model.grid[lastRow][model.width - 1];
    if (!anchorInfo || !focusInfo) return;
    ui.noteTableAnchorCell = anchorInfo.cell;
    ui.noteTableFocusCell = focusInfo.cell;
    renderNoteTableSelection();
    collapseNativeTableTextSelection(focusInfo.cell);
    refreshNoteTableSelectHandle();
    toast(i18n.isEnglish() ? "Whole table selected." : "已选中整个表格。");
  }

  function placeCaretInNode(node) {
    if (!node) return;
    var range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    var selection = window.getSelection && window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
      ui.richTextSelection = { editorId: "note-editor", range: range.cloneRange() };
    }
    dom["note-editor"].focus();
  }

  function selectNoteTableCell(cell) {
    if (!cell) {
      clearNoteTableSelection();
      return;
    }
    ui.noteTableAnchorCell = cell;
    ui.noteTableFocusCell = cell;
    renderNoteTableSelection();
    placeCaretInNode(cell);
  }

  function emptyTableCell(tagName) {
    var cell = document.createElement(tagName === "TH" ? "th" : "td");
    cell.appendChild(document.createElement("br"));
    return cell;
  }

  function tableHtmlFromDimensions(rows, columns, values, includeTrailingParagraph) {
    var output = ["<table><tbody>"];
    for (var row = 0; row < rows; row += 1) {
      output.push("<tr>");
      for (var column = 0; column < columns; column += 1) {
        var value = values && values[row] ? values[row][column] : "";
        output.push("<td>" + (value ? richText.escapeHtml(value) : "<br>") + "</td>");
      }
      output.push("</tr>");
    }
    output.push("</tbody></table>");
    if (includeTrailingParagraph !== false) output.push("<p><br></p>");
    return output.join("");
  }

  function insertHtmlWithNativeUndo(editor, html) {
    if (!editor) return false;
    var sanitized = richText.sanitizeHtml(html, richText.MAX_NOTE_TEXT);
    if (!sanitized) return false;
    restoreRichTextSelection(editor);
    var inserted = false;
    try {
      inserted = document.execCommand("insertHTML", false, sanitized);
    } catch (_error) {
      inserted = false;
    }
    if (!inserted) inserted = richText.insertHtmlAtSelection(sanitized, editor);
    return inserted;
  }

  function replaceNoteTableWithNativeUndo(table, replacementHtml) {
    var editor = dom["note-editor"];
    if (!table || !table.isConnected || !editor.contains(table)) {
      return { success: false, table: null };
    }
    var tableIndex = queryAll("table", editor).indexOf(table);
    var range = document.createRange();
    range.selectNode(table);
    var selection = window.getSelection && window.getSelection();
    if (!selection) return { success: false, table: null };
    try {
      editor.focus({ preventScroll: true });
    } catch (_error) {
      editor.focus();
    }
    selection.removeAllRanges();
    selection.addRange(range);
    ui.richTextSelection = { editorId: "note-editor", range: range.cloneRange() };
    if (!insertHtmlWithNativeUndo(editor, replacementHtml)) {
      return { success: false, table: null };
    }
    var expectsTable = /<table\b/i.test(replacementHtml);
    return {
      success: true,
      table: expectsTable && tableIndex >= 0
        ? queryAll("table", editor)[tableIndex] || null
        : null
    };
  }

  function insertNoteTableHtml(tableHtml) {
    var editor = dom["note-editor"];
    var existingTables = new Set(queryAll("table", editor));
    if (!insertHtmlWithNativeUndo(editor, tableHtml)) {
      var template = document.createElement("template");
      template.innerHTML = richText.sanitizeHtml(tableHtml, richText.MAX_NOTE_TEXT);
      editor.appendChild(template.content);
    }
    var inserted = queryAll("table", editor).find(function (table) {
      return !existingTables.has(table);
    });
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    if (inserted) selectNoteTableCell(query("td, th", inserted));
    return inserted;
  }

  function insertNoteTable(rows, columns) {
    rows = Math.min(20, Math.max(1, Number(rows) || 1));
    columns = Math.min(20, Math.max(1, Number(columns) || 1));
    insertNoteTableHtml(tableHtmlFromDimensions(rows, columns));
    closeNoteTableMenu();
  }

  function setCellSpan(cell, attribute, value) {
    if (value > 1) cell.setAttribute(attribute, String(value));
    else cell.removeAttribute(attribute);
  }

  function insertTableRowBelow(region, focusCell) {
    var model = region.model;
    var activeInfo = model.infoByCell.get(focusCell || ui.noteTableFocusCell);
    var currentRow = activeInfo && model.rows[activeInfo.row];
    if (!currentRow) return null;
    var insertAt = activeInfo.row + 1;
    var crossing = [];
    Array.from(model.infoByCell.values()).forEach(function (info) {
      if (info.row < insertAt && info.row + info.rowSpan > insertAt) {
        crossing.push(info);
        info.rowSpan += 1;
        setCellSpan(info.cell, "rowspan", info.rowSpan);
      }
    });
    var newRow = document.createElement("tr");
    var firstCell = null;
    for (var column = 0; column < Math.max(1, model.width); column += 1) {
      var covered = crossing.some(function (info) {
        return column >= info.column && column < info.column + info.colSpan;
      });
      if (covered) continue;
      var cell = emptyTableCell("TD");
      if (!firstCell) firstCell = cell;
      newRow.appendChild(cell);
    }
    currentRow.parentNode.insertBefore(newRow, currentRow.nextSibling);
    return firstCell || (crossing[0] && crossing[0].cell);
  }

  function insertTableColumnRight(region, focusCell) {
    var model = region.model;
    var activeInfo = model.infoByCell.get(focusCell || ui.noteTableFocusCell);
    if (!activeInfo) return null;
    var insertAt = activeInfo.column + activeInfo.colSpan;
    var crossing = [];
    Array.from(model.infoByCell.values()).forEach(function (info) {
      if (info.column < insertAt && info.column + info.colSpan > insertAt) {
        crossing.push(info);
        info.colSpan += 1;
        setCellSpan(info.cell, "colspan", info.colSpan);
      }
    });
    var firstCell = null;
    model.rows.forEach(function (row, rowIndex) {
      var covered = crossing.some(function (info) {
        return rowIndex >= info.row && rowIndex < info.row + info.rowSpan;
      });
      if (covered) return;
      var tagName = row.parentElement && row.parentElement.tagName === "THEAD" ? "TH" : "TD";
      var cell = emptyTableCell(tagName);
      var before = Array.prototype.slice.call(row.cells || []).find(function (candidate) {
        var info = model.infoByCell.get(candidate);
        return info && info.column >= insertAt;
      });
      row.insertBefore(cell, before || null);
      if (!firstCell || rowIndex === activeInfo.row) firstCell = cell;
    });
    return firstCell;
  }

  function removeTableAndKeepCaret(table) {
    var paragraph = document.createElement("p");
    paragraph.appendChild(document.createElement("br"));
    table.replaceWith(paragraph);
    clearNoteTableSelection();
    placeCaretInNode(paragraph);
  }

  function deleteCurrentTableRow(region, focusCell) {
    var model = region.model;
    var activeInfo = model.infoByCell.get(focusCell || ui.noteTableFocusCell);
    var rowIndex = activeInfo && activeInfo.row;
    var row = Number.isInteger(rowIndex) ? model.rows[rowIndex] : null;
    if (!row) return null;
    if (model.rows.length <= 1) {
      removeTableAndKeepCaret(region.table);
      return null;
    }
    var nextRow = model.rows[rowIndex + 1] || null;
    Array.from(model.infoByCell.values())
      .sort(function (left, right) { return left.column - right.column; })
      .forEach(function (info) {
        if (info.row < rowIndex && info.row + info.rowSpan > rowIndex) {
          info.rowSpan -= 1;
          setCellSpan(info.cell, "rowspan", info.rowSpan);
        } else if (info.row === rowIndex && info.rowSpan > 1 && nextRow) {
          info.rowSpan -= 1;
          setCellSpan(info.cell, "rowspan", info.rowSpan);
          var before = Array.prototype.slice.call(nextRow.cells || []).find(function (candidate) {
            var candidateInfo = model.infoByCell.get(candidate);
            return candidateInfo && candidateInfo.column > info.column;
          });
          nextRow.insertBefore(info.cell, before || null);
        }
      });
    row.remove();
    var refreshed = buildTableModel(region.table);
    var targetRow = Math.min(rowIndex, refreshed.rows.length - 1);
    var targetInfo = refreshed.grid[targetRow] &&
      (refreshed.grid[targetRow][activeInfo.column] || refreshed.grid[targetRow][0]);
    return targetInfo && targetInfo.cell;
  }

  function deleteCurrentTableColumn(region, focusCell) {
    var model = region.model;
    var activeInfo = model.infoByCell.get(focusCell || ui.noteTableFocusCell);
    if (!activeInfo) return null;
    if (model.width <= 1) {
      removeTableAndKeepCaret(region.table);
      return null;
    }
    var column = activeInfo.column;
    Array.from(model.infoByCell.values()).forEach(function (info) {
      if (column < info.column || column >= info.column + info.colSpan) return;
      if (info.colSpan > 1) {
        info.colSpan -= 1;
        setCellSpan(info.cell, "colspan", info.colSpan);
      } else {
        info.cell.remove();
      }
    });
    if (!query("td, th", region.table)) {
      removeTableAndKeepCaret(region.table);
      return null;
    }
    var refreshed = buildTableModel(region.table);
    var targetRow = Math.min(activeInfo.row, refreshed.rows.length - 1);
    var targetColumn = Math.min(column, refreshed.width - 1);
    var targetInfo = refreshed.grid[targetRow] &&
      (refreshed.grid[targetRow][targetColumn] || refreshed.grid[targetRow][0]);
    return targetInfo && targetInfo.cell;
  }

  function mergeSelectedTableCells(region) {
    if (!region || region.cells.length < 2) return null;
    var model = region.model;
    var invalid = region.cells.some(function (cell) {
      var info = model.infoByCell.get(cell);
      return (
        info.row < region.minRow ||
        info.column < region.minColumn ||
        info.row + info.rowSpan - 1 > region.maxRow ||
        info.column + info.colSpan - 1 > region.maxColumn
      );
    });
    if (invalid) {
      toast(
        i18n.isEnglish()
          ? "The selected range crosses an existing merged cell. Select a complete rectangular range."
          : "所选区域穿过了已有合并单元格，请选择完整的矩形区域。",
        "warning"
      );
      return null;
    }
    var primaryInfo = model.grid[region.minRow] && model.grid[region.minRow][region.minColumn];
    var primary = primaryInfo && primaryInfo.cell;
    if (!primary) return null;
    var contents = region.cells
      .map(function (cell) { return cell.innerHTML; })
      .filter(function (html) { return richText.plainText(html).trim(); });
    primary.innerHTML = contents.length ? contents.join("<br>") : "<br>";
    region.cells.forEach(function (cell) {
      if (cell !== primary) cell.remove();
    });
    setCellSpan(primary, "rowspan", region.maxRow - region.minRow + 1);
    setCellSpan(primary, "colspan", region.maxColumn - region.minColumn + 1);
    return primary;
  }

  function cloneNoteTableEditContext(region) {
    var anchorInfo = region.model.infoByCell.get(ui.noteTableAnchorCell);
    var focusInfo = region.model.infoByCell.get(ui.noteTableFocusCell);
    if (!anchorInfo || !focusInfo) return null;
    var table = region.table.cloneNode(true);
    var model = buildTableModel(table);
    var anchor = model.grid[anchorInfo.row] && model.grid[anchorInfo.row][anchorInfo.column];
    var focus = model.grid[focusInfo.row] && model.grid[focusInfo.row][focusInfo.column];
    if (!anchor || !focus) return null;
    var clonedRegion = tableRegionBetweenCells(anchor.cell, focus.cell, table);
    return clonedRegion
      ? { table: table, region: clonedRegion, focusCell: focus.cell }
      : null;
  }

  function editNoteTable(operation) {
    var region = noteTableRegion();
    if (!region) {
      toast(
        i18n.isEnglish() ? "Click a table cell before using table editing." : "请先点击要编辑的表格单元格。",
        "warning"
      );
      return;
    }
    var context = cloneNoteTableEditContext(region);
    if (!context) return;
    var beforeTableHtml = richText.sanitizeHtml(context.table.outerHTML, richText.MAX_NOTE_TEXT);
    var removeTable =
      (operation === "delete-row" && context.region.model.rows.length <= 1) ||
      (operation === "delete-column" && context.region.model.width <= 1);
    var nextCell = null;
    if (!removeTable) {
      if (operation === "insert-row") {
        nextCell = insertTableRowBelow(context.region, context.focusCell);
      }
      if (operation === "insert-column") {
        nextCell = insertTableColumnRight(context.region, context.focusCell);
      }
      if (operation === "delete-row") {
        nextCell = deleteCurrentTableRow(context.region, context.focusCell);
      }
      if (operation === "delete-column") {
        nextCell = deleteCurrentTableColumn(context.region, context.focusCell);
      }
      if (operation === "merge-cells") nextCell = mergeSelectedTableCells(context.region);
    }
    var nextPosition = null;
    if (nextCell && context.table.contains(nextCell)) {
      var changedModel = buildTableModel(context.table);
      var nextInfo = changedModel.infoByCell.get(nextCell);
      if (nextInfo) nextPosition = { row: nextInfo.row, column: nextInfo.column };
    }
    var replacementHtml = removeTable
      ? "<p><br></p>"
      : richText.sanitizeHtml(context.table.outerHTML, richText.MAX_NOTE_TEXT);
    if (!removeTable && replacementHtml === beforeTableHtml) {
      closeNoteTableMenu();
      return;
    }
    var replacement = replaceNoteTableWithNativeUndo(region.table, replacementHtml);
    if (!replacement.success) return;
    clearNoteTableSelection();
    if (replacement.table && nextPosition) {
      var replacementModel = buildTableModel(replacement.table);
      var replacementInfo = replacementModel.grid[nextPosition.row] &&
        (replacementModel.grid[nextPosition.row][nextPosition.column] ||
          replacementModel.grid[nextPosition.row][0]);
      if (replacementInfo) selectNoteTableCell(replacementInfo.cell);
    }
    dom["note-editor"].dispatchEvent(new Event("input", { bubbles: true }));
    closeNoteTableMenu();
  }

  function tableHtmlFromTabText(text) {
    var source = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (!source.includes("\t")) return "";
    var rows = source.replace(/\n$/, "").split("\n").slice(0, 200).map(function (line) {
      return line.split("\t").slice(0, 100);
    });
    var columns = rows.reduce(function (maximum, row) {
      return Math.max(maximum, row.length);
    }, 0);
    return rows.length && columns > 1
      ? tableHtmlFromDimensions(rows.length, columns, rows, false)
      : "";
  }

  function cloneSelectedTableRegion(region) {
    var table = document.createElement("table");
    var body = document.createElement("tbody");
    var emitted = new Set();
    table.appendChild(body);
    for (var row = region.minRow; row <= region.maxRow; row += 1) {
      var targetRow = document.createElement("tr");
      for (var column = region.minColumn; column <= region.maxColumn; column += 1) {
        var info = region.model.grid[row] && region.model.grid[row][column];
        if (!info || emitted.has(info.cell)) continue;
        emitted.add(info.cell);
        var clone = info.cell.cloneNode(true);
        setCellSpan(clone, "rowspan", info.rowSpan);
        setCellSpan(clone, "colspan", info.colSpan);
        targetRow.appendChild(clone);
      }
      body.appendChild(targetRow);
    }
    return table;
  }

  function handleNoteTableCopy(event) {
    if (!event.clipboardData) return;
    var selection = window.getSelection && window.getSelection();
    if (!selection || !selection.rangeCount) return;
    var range = selectionRangeInsideEditor(dom["note-editor"], selection);
    if (!range) return;
    var wrapper = document.createElement("div");
    wrapper.appendChild(range.cloneContents());
    var html = wrapper.querySelector("table") ? wrapper.innerHTML : "";
    var region = noteTableRegion();
    if (
      !html &&
      region &&
      (region.cells.length > 1 || noteTableRegionIsWholeTable(region))
    ) {
      html = cloneSelectedTableRegion(region).outerHTML;
    }
    if (!html) return;
    html = richText.sanitizeHtml(html, richText.MAX_NOTE_TEXT);
    event.preventDefault();
    event.clipboardData.setData("text/html", html);
    event.clipboardData.setData("text/plain", richText.plainText(html));
  }

  function handleRichTextPaste(event) {
    event.preventDefault();
    var editor = event.currentTarget;
    var text = event.clipboardData ? event.clipboardData.getData("text/plain") : "";
    var clipboardHtml = event.clipboardData ? event.clipboardData.getData("text/html") : "";
    if (editor === dom["note-editor"]) {
      var tableHtml = richText.tableHtmlFromClipboard(clipboardHtml) || tableHtmlFromTabText(text);
      if (tableHtml) {
        insertNoteTableHtml(tableHtml + "<p><br></p>");
        return;
      }
    }
    restoreRichTextSelection(editor);
    if (!richText.insertHtmlAtSelection(richText.fromPlainText(text), editor)) {
      editor.appendChild(document.createTextNode(text));
    }
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function noteTimeLabel(value) {
    return value
      ? new Date(value).toLocaleString(i18n.locale(), {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "";
  }

  function markNoteDirty() {
    ui.noteDirty = true;
    dom["note-save-state"].textContent = i18n.isEnglish() ? "Unsaved changes" : "有未保存修改";
    dom["note-save-state"].classList.add("is-dirty");
    updateNoteCharacterCount();
  }

  function updateNoteCharacterCount() {
    var length = richText.plainText(dom["note-editor"].innerHTML).length;
    dom["note-character-count"].textContent = length + " / " + richText.MAX_NOTE_TEXT;
    dom["note-character-count"].style.color =
      length > richText.MAX_NOTE_TEXT ? "var(--coral)" : "";
  }

  function renderNotes() {
    renderNoteList();
    if (ui.noteDirty) return;
    var selected = getNote(ui.selectedNoteId);
    if (ui.noteScope === "favorites" && selected && !selected.favorite) {
      ui.selectedNoteId = null;
    }
    var visibleNotes = getVisibleNotes();
    if (!ui.noteIsNew && !ui.selectedNoteId && visibleNotes.length) {
      ui.selectedNoteId = visibleNotes[0].id;
    }
    renderSelectedNote();
  }

  function getVisibleNotes() {
    var queryText = String(ui.noteSearch || "").trim().toLocaleLowerCase();
    return data.notes
      .filter(function (note) {
        if (ui.noteScope === "favorites" && !note.favorite) return false;
        if (!queryText) return true;
        return (note.title + "\n" + note.contentText).toLocaleLowerCase().includes(queryText);
      })
      .slice()
      .sort(function (left, right) {
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      });
  }

  function renderNoteScopeControls() {
    var favoriteCount = data.notes.filter(function (note) { return note.favorite; }).length;
    dom["note-all-count"].textContent = String(data.notes.length);
    dom["note-favorite-count"].textContent = String(favoriteCount);
    [dom["note-filter-all"], dom["note-filter-favorites"]].forEach(function (button) {
      var active = button.dataset.noteScope === ui.noteScope;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  function setNoteScope(scope) {
    ui.noteScope = scope === "favorites" ? "favorites" : "all";
    if (!ui.noteDirty && !ui.noteIsNew) {
      var selected = getNote(ui.selectedNoteId);
      if (ui.noteScope === "favorites" && selected && !selected.favorite) {
        ui.selectedNoteId = null;
      }
      if (!ui.selectedNoteId) {
        var first = getVisibleNotes()[0];
        ui.selectedNoteId = first ? first.id : null;
      }
    }
    renderNoteList();
    if (!ui.noteDirty && !ui.noteIsNew) renderSelectedNote();
  }

  function renderNoteList() {
    var container = utils.clear(dom["note-list"]);
    var notes = getVisibleNotes();
    renderNoteScopeControls();
    dom["notes-count"].textContent = data.notes.length + (i18n.isEnglish() ? " notes" : " 条笔记");
    if (!notes.length) {
      container.appendChild(
        utils.el(
          "p",
          "note-list-empty",
          data.notes.length
            ? ui.noteScope === "favorites"
              ? i18n.isEnglish()
                ? "No favorite notes match the current search."
                : "收藏夹中没有符合当前搜索的笔记。"
              : i18n.isEnglish()
                ? "No notes match the search."
                : "没有符合搜索条件的笔记。"
            : i18n.isEnglish()
              ? "Saved notes will appear here."
              : "保存后的笔记会显示在这里。"
        )
      );
      return;
    }
    notes.forEach(function (note) {
      var row = utils.el("div", "note-list-row");
      row.setAttribute("role", "listitem");
      var button = utils.el(
        "button",
        "note-list-item" + (note.id === ui.selectedNoteId ? " is-active" : "")
      );
      button.type = "button";
      button.dataset.action = "edit-note";
      button.dataset.noteId = note.id;
      button.dataset.userContent = "";
      button.append(
        utils.el("strong", "", note.title),
        utils.el(
          "span",
          "",
          note.contentText
            ? note.contentText.replace(/\s+/g, " ").slice(0, 72)
            : i18n.isEnglish()
              ? "Empty note"
              : "空白笔记"
        ),
        utils.el("small", "", noteTimeLabel(note.updatedAt))
      );
      var favorite = utils.el(
        "button",
        "note-favorite-button" + (note.favorite ? " is-favorite" : ""),
        note.favorite ? "★" : "☆"
      );
      favorite.type = "button";
      favorite.dataset.action = "toggle-note-favorite";
      favorite.dataset.noteId = note.id;
      favorite.setAttribute(
        "aria-label",
        i18n.isEnglish()
          ? (note.favorite ? "Remove from favorites: " : "Add to favorites: ") + note.title
          : (note.favorite ? "取消收藏：" : "收藏笔记：") + note.title
      );
      favorite.title = favorite.getAttribute("aria-label");
      row.append(button, favorite);
      container.appendChild(row);
    });
  }

  function renderNoteFavoriteToggle(note) {
    var button = dom["note-favorite-toggle"];
    if (!button) return;
    button.hidden = !note;
    if (!note) return;
    button.classList.toggle("is-favorite", Boolean(note.favorite));
    button.firstElementChild.textContent = note.favorite ? "★" : "☆";
    var label = i18n.isEnglish()
      ? note.favorite ? "Remove from favorites" : "Add note to favorites"
      : note.favorite ? "取消收藏" : "收藏笔记";
    button.setAttribute("aria-label", label);
    button.title = label;
    var accessible = query(".sr-only", button);
    if (accessible) accessible.textContent = label;
  }

  function renderSelectedNote() {
    var note = getNote(ui.selectedNoteId);
    var editing = Boolean(note || ui.noteIsNew);
    dom["note-empty-state"].hidden = editing;
    dom["note-editor-shell"].hidden = !editing;
    if (!editing) return;
    dom["note-title"].value = note ? note.title : "";
    dom["note-title"].classList.remove("is-invalid");
    dom["note-editor"].innerHTML = note ? note.contentHtml : "";
    hideNoteTableSelectHandle();
    clearNoteTableSelection();
    dom["note-save-state"].textContent = note
      ? i18n.isEnglish()
        ? "Saved"
        : "已保存"
      : i18n.isEnglish()
        ? "Not saved"
        : "尚未保存";
    dom["note-save-state"].classList.remove("is-dirty");
    dom["note-updated-at"].textContent = note
      ? (i18n.isEnglish() ? "Last updated: " : "最后更新：") + noteTimeLabel(note.updatedAt)
      : i18n.isEnglish()
        ? "Not saved"
        : "尚未保存";
    dom["note-delete-button"].hidden = !note;
    renderNoteFavoriteToggle(note);
    renderNoteConversionSummary(note);
    updateNoteCharacterCount();
  }

  function renderNoteConversionSummary(note) {
    var container = dom["note-conversion-summary"];
    var conversions = note && Array.isArray(note.conversions) ? note.conversions : [];
    container.hidden = !conversions.length;
    if (!conversions.length) {
      container.textContent = "";
      return;
    }
    var progressCount = conversions.filter(function (item) { return item.type === "progress"; }).length;
    var taskCount = conversions
      .filter(function (item) { return item.type === "task"; })
      .reduce(function (total, item) { return total + item.taskIds.length; }, 0);
    container.textContent = i18n.isEnglish()
      ? "Converted snapshots: " + progressCount + " progress records · " + taskCount + " Tasks"
      : "已完成一次性转换：" + progressCount + " 条进度记录 · " + taskCount + " 个 Task";
  }

  function confirmDiscardNoteChanges() {
    return (
      !ui.noteDirty ||
      confirmAction("当前笔记尚未保存，继续后修改会丢失。仍要继续吗？")
    );
  }

  function openNewNote() {
    if (!confirmDiscardNoteChanges()) return;
    ui.selectedNoteId = null;
    ui.noteIsNew = true;
    ui.noteDirty = false;
    ui.aiOriginalHtml = null;
    hideAiOriginalPanel();
    renderNoteList();
    renderSelectedNote();
    setTimeout(function () { dom["note-title"].focus(); }, 0);
  }

  function selectNote(noteId) {
    if (noteId === ui.selectedNoteId && !ui.noteIsNew) return;
    if (!confirmDiscardNoteChanges()) return;
    if (!getNote(noteId)) return;
    ui.selectedNoteId = noteId;
    ui.noteIsNew = false;
    ui.noteDirty = false;
    ui.aiOriginalHtml = null;
    hideAiOriginalPanel();
    renderNoteList();
    renderSelectedNote();
  }

  function toggleNoteFavorite(noteId) {
    var note = getNote(noteId);
    if (!note) return;
    note.favorite = !note.favorite;
    var favorite = note.favorite;
    try {
      data = storage.save(data);
      if (
        ui.noteScope === "favorites" &&
        !favorite &&
        noteId === ui.selectedNoteId &&
        !ui.noteDirty
      ) {
        var next = getVisibleNotes()[0];
        ui.selectedNoteId = next ? next.id : null;
      }
      renderNoteList();
      if (!ui.noteDirty && noteId !== ui.selectedNoteId) renderSelectedNote();
      renderNoteFavoriteToggle(getNote(ui.selectedNoteId));
      toast(
        favorite
          ? i18n.isEnglish() ? "Added to Favorites" : "已加入收藏夹"
          : i18n.isEnglish() ? "Removed from Favorites" : "已取消收藏"
      );
    } catch (error) {
      note.favorite = !note.favorite;
      toast("保存失败：" + error.message, "error", 6500);
    }
  }

  function saveCurrentNote(silent) {
    var title = dom["note-title"].value.trim();
    if (!title) {
      dom["note-title"].classList.add("is-invalid");
      dom["note-title"].focus();
      if (!silent) toast(i18n.isEnglish() ? "Enter a note title." : "请输入笔记标题。", "error");
      return null;
    }
    var contentHtml = richText.sanitizeHtml(
      dom["note-editor"].innerHTML,
      richText.MAX_NOTE_TEXT
    );
    var contentText = richText.plainText(contentHtml);
    if (contentText.length > richText.MAX_NOTE_TEXT) {
      toast(i18n.isEnglish() ? "The note is too long." : "笔记内容过长。", "error");
      return null;
    }
    var stamp = new Date().toISOString();
    var note = getNote(ui.selectedNoteId);
    if (note) {
      note.title = title;
      note.contentHtml = contentHtml;
      note.contentText = contentText;
      note.updatedAt = stamp;
    } else {
      note = {
        id: utils.uid("note"),
        title: title,
        contentHtml: contentHtml,
        contentText: contentText,
        favorite: false,
        conversions: [],
        createdAt: stamp,
        updatedAt: stamp
      };
      data.notes.push(note);
    }
    ui.selectedNoteId = note.id;
    ui.noteIsNew = false;
    ui.noteDirty = false;
    if (!persistAndRender(silent ? "" : i18n.isEnglish() ? "Note saved" : "笔记已保存")) {
      ui.noteDirty = true;
      return null;
    }
    return getNote(note.id);
  }

  function ensureCurrentNoteSaved() {
    var note = getNote(ui.selectedNoteId);
    if (!note || ui.noteDirty || ui.noteIsNew) note = saveCurrentNote(true);
    return note;
  }

  function deleteCurrentNote() {
    var note = getNote(ui.selectedNoteId);
    if (!note) return;
    if (!confirmAction("确认删除笔记「" + note.title + "」？已转换的 Task 和进度记录不会删除。")) return;
    if (!confirmAction("请再次确认删除这条笔记。删除后无法恢复。")) return;
    data.notes = data.notes.filter(function (item) { return item.id !== note.id; });
    ui.selectedNoteId = null;
    ui.noteDirty = false;
    ui.noteIsNew = false;
    ui.aiOriginalHtml = null;
    hideAiOriginalPanel();
    persistAndRender(i18n.isEnglish() ? "Note deleted" : "笔记已删除");
  }

  function populateNoteProgressRelations() {
    var groupSelect = dom["note-progress-group"];
    if (!groupSelect.options.length) {
      getSortedGroups().forEach(function (group) {
        var option = utils.el("option", "", group.name);
        option.value = group.id;
        groupSelect.appendChild(option);
      });
    }
    var groupId = groupSelect.value;
    var flowSelect = utils.clear(dom["note-progress-flow"]);
    var all = utils.el("option", "", i18n.isEnglish() ? "All Flows" : "全部 Flow");
    all.value = "all";
    flowSelect.appendChild(all);
    var standalone = utils.el("option", "", i18n.isEnglish() ? "No Flow" : "未加入 Flow");
    standalone.value = "none";
    flowSelect.appendChild(standalone);
    getSortedFlows(groupId).forEach(function (flow) {
      var option = utils.el("option", "", flow.name);
      option.value = flow.id;
      flowSelect.appendChild(option);
    });
    populateNoteProgressTasks();
  }

  function populateNoteProgressTasks() {
    var groupId = dom["note-progress-group"].value;
    var flowId = dom["note-progress-flow"].value || "all";
    var select = utils.clear(dom["note-progress-task"]);
    var tasks = data.tasks
      .filter(function (task) {
        if (task.groupId !== groupId) return false;
        if (flowId === "none") return !task.flowId;
        return flowId === "all" || task.flowId === flowId;
      })
      .slice()
      .sort(function (left, right) {
        return left.name.localeCompare(right.name, i18n.locale(), { numeric: true });
      });
    tasks.forEach(function (task) {
      var option = utils.el("option", "", task.name + " · DDL " + task.ddl);
      option.value = task.id;
      select.appendChild(option);
    });
    dom["note-progress-task-help"].textContent = tasks.length
      ? i18n.isEnglish()
        ? tasks.length + " Tasks available"
        : "可选择 " + tasks.length + " 个 Task"
      : i18n.isEnglish()
        ? "No Tasks are available under the selected scope."
        : "当前范围下没有可选择的 Task。";
  }

  function openNoteProgressDialog() {
    var note = ensureCurrentNoteSaved();
    if (!note) return;
    if (!data.tasks.length) {
      toast(i18n.isEnglish() ? "Create a Task before adding a progress record." : "请先创建 Task，再添加进度记录。", "warning");
      return;
    }
    utils.clear(dom["note-progress-group"]);
    dom["note-progress-context"].textContent = note.title + (i18n.isEnglish() ? " · A new timestamped record will be appended." : " · 将按当前时间新增一条独立记录。" );
    dom["note-progress-preview"].innerHTML = note.contentHtml || richText.fromPlainText(note.contentText);
    populateNoteProgressRelations();
    dom["note-progress-dialog"].showModal();
  }

  function updateTaskProgressAliases(task) {
    var latest = richText.latestProgressEntry(task);
    task.progressNote = latest ? latest.contentText : "";
    task.progressUpdatedAt = latest ? latest.updatedAt : null;
  }

  function convertNoteToProgress(event) {
    event.preventDefault();
    var note = getNote(ui.selectedNoteId);
    var task = getTask(dom["note-progress-task"].value);
    if (!note || !task) {
      toast(i18n.isEnglish() ? "Select a valid Task." : "请选择有效 Task。", "error");
      return;
    }
    var stamp = new Date().toISOString();
    var entry = storage.normalizeProgressEntry({
      id: utils.uid("progress"),
      contentHtml: note.contentHtml,
      contentText: note.contentText,
      sourceType: "quick-note",
      sourceNoteId: note.id,
      createdAt: stamp,
      updatedAt: stamp
    });
    task.progressEntries = (task.progressEntries || []).concat(entry);
    updateTaskProgressAliases(task);
    task.updatedAt = stamp;
    note.conversions.push({
      id: utils.uid("conversion"),
      type: "progress",
      taskIds: [task.id],
      progressEntryIds: [entry.id],
      skippedCount: 0,
      createdAt: stamp
    });
    note.updatedAt = stamp;
    if (persistAndRender(i18n.isEnglish() ? "Progress record added" : "已新增一条 Task 进度记录")) {
      dom["note-progress-dialog"].close();
    }
  }

  function populateAiModelOptions(selectedModel) {
    var provider = aiProvider.getProvider(dom["ai-provider"].value);
    var select = utils.clear(dom["ai-model"]);
    var placeholder = utils.el("option", "", i18n.isEnglish() ? "Select a model" : "请选择模型");
    placeholder.value = "";
    select.appendChild(placeholder);
    (provider.models || []).forEach(function (model) {
      var option = utils.el("option", "", model);
      option.value = model;
      select.appendChild(option);
    });
    var customOption = utils.el("option", "", i18n.isEnglish() ? "Custom model…" : "自定义模型…");
    customOption.value = "__custom__";
    select.appendChild(customOption);
    var value = selectedModel || "";
    var known = (provider.models || []).indexOf(value) >= 0;
    if (known) {
      select.value = value;
      dom["ai-model-custom"].hidden = true;
      dom["ai-model-custom"].value = "";
    } else if (value) {
      select.value = "__custom__";
      dom["ai-model-custom"].hidden = false;
      dom["ai-model-custom"].value = value;
    } else {
      select.value = "";
      dom["ai-model-custom"].hidden = true;
      dom["ai-model-custom"].value = "";
    }
  }

  function openAiSettingsDialog() {
    var settings = aiProvider.getSettings();
    dom["ai-enabled"].checked = settings.enabled;
    dom["ai-provider"].value = settings.provider;
    dom["ai-api-key"].value = settings.apiKey;
    dom["ai-base-url"].value = settings.baseUrl;
    populateAiModelOptions(settings.model);
    updateAiSettingsStatus();
    dom["ai-settings-dialog"].showModal();
  }

  function closeAiSettingsDialog() {
    dom["ai-settings-dialog"].close();
  }

  function handleAiProviderChange() {
    var provider = aiProvider.getProvider(dom["ai-provider"].value);
    dom["ai-base-url"].value = provider.baseUrl || "";
    populateAiModelOptions(provider.models && provider.models.length ? provider.models[0] : "");
    updateAiSettingsStatus();
  }

  function handleAiModelChange() {
    if (dom["ai-model"].value === "__custom__") {
      dom["ai-model-custom"].hidden = false;
      dom["ai-model-custom"].focus();
    } else {
      dom["ai-model-custom"].hidden = true;
      dom["ai-model-custom"].value = "";
    }
  }

  function collectAiSettingsFromForm() {
    return {
      enabled: dom["ai-enabled"].checked,
      noteAiEnabled: aiProvider.getSettings().noteAiEnabled,
      provider: dom["ai-provider"].value,
      apiKey: dom["ai-api-key"].value.trim(),
      baseUrl: dom["ai-base-url"].value.trim(),
      model: dom["ai-model"].value === "__custom__" || dom["ai-model"].value === ""
        ? dom["ai-model-custom"].value.trim()
        : dom["ai-model"].value.trim()
    };
  }

  function updateAiSettingsStatus(message, type) {
    if (!dom["ai-settings-status"]) return;
    if (!message) {
      var settings = aiProvider.getSettings();
      dom["ai-settings-status"].textContent = aiProvider.isConfigured(settings)
        ? (settings.enabled
            ? (i18n.isEnglish() ? "Connected and enabled: " : "已接入并启用 ") + settings.provider + " / " + settings.model
            : (i18n.isEnglish() ? "Connection saved, AI not enabled" : "已保存连接，但当前未启用 AI"))
        : (i18n.isEnglish() ? "AI not connected" : "尚未接入 AI");
      dom["ai-settings-status"].className = "ai-settings-status" + (settings.enabled ? " is-ok" : "");
      return;
    }
    dom["ai-settings-status"].textContent = message;
    dom["ai-settings-status"].className = "ai-settings-status" + (type === "error" ? " is-error" : type === "ok" ? " is-ok" : "");
  }

  function aiErrorMessage(error) {
    var code = error && error.code;
    if (code === "AI_TIMEOUT") {
      return i18n.isEnglish()
        ? "The AI request timed out. Check the network and try again."
        : "AI 请求超时，请检查网络后重试。";
    }
    if (code === "AI_INVALID_RESPONSE") {
      return i18n.isEnglish()
        ? "The AI service returned an unreadable response."
        : "AI 服务返回了无法识别的内容。";
    }
    var message = String(error && error.message || (i18n.isEnglish() ? "Unknown error" : "未知错误"));
    if (i18n.isEnglish()) {
      var englishMessages = {
        "请先完成 AI 接入配置。": "Complete AI setup first.",
        "AI 返回内容为空（输出长度受限，请重试或更换模型）。": "The AI response was empty because the output limit was reached. Try again or choose another model.",
        "AI 返回内容为空。": "The AI response was empty.",
        "AI 返回不是有效 JSON。": "The AI response was not valid JSON.",
        "AI 未识别到 Task。": "AI did not detect any Tasks.",
        "AI 未识别到 Task": "AI did not detect any Tasks.",
        "未知错误": "Unknown error"
      };
      return englishMessages[message] || message;
    }
    return message;
  }

  function saveAiSettings(event) {
    if (event) event.preventDefault();
    var settings = collectAiSettingsFromForm();
    if (settings.enabled && !settings.apiKey) {
      toast(i18n.isEnglish() ? "Enter an API Key to enable AI." : "启用 AI 需要先填写 API Key。", "error");
      return;
    }
    if (settings.enabled && !settings.baseUrl) {
      toast(i18n.isEnglish() ? "Enter an API Base URL." : "请填写 API Base URL。", "error");
      return;
    }
    if (settings.enabled && !settings.model) {
      toast(i18n.isEnglish() ? "Enter a model name." : "请填写模型名称。", "error");
      return;
    }
    var saved = aiProvider.saveSettings(settings);
    updateAiUi();
    updateAiSettingsStatus(i18n.isEnglish() ? "Settings saved." : "已保存设置。", "ok");
    toast(i18n.isEnglish() ? "AI settings saved" : "AI 设置已保存");
    dom["ai-settings-dialog"].close();
  }

  function testAiConnection() {
    if (ui.aiTesting) return;
    var settings = collectAiSettingsFromForm();
    if (!settings.apiKey || !settings.baseUrl || !settings.model) {
      toast(i18n.isEnglish() ? "Complete API Key, Base URL and model first." : "请先填写 API Key、Base URL 和模型。", "error");
      return;
    }
    ui.aiTesting = true;
    updateAiSettingsStatus(i18n.isEnglish() ? "Testing connection..." : "正在测试连接…");
    aiProvider.testConnection(settings).then(function (result) {
      settings.enabled = true;
      dom["ai-enabled"].checked = true;
      aiProvider.saveSettings(settings);
      updateAiUi();
      updateAiSettingsStatus((i18n.isEnglish() ? "Connection successful: " : "连接成功：") + result.message, "ok");
      toast(i18n.isEnglish() ? "AI connection successful" : "AI 连接成功");
    }).catch(function (error) {
      var message = aiErrorMessage(error);
      updateAiSettingsStatus((i18n.isEnglish() ? "Connection failed: " : "连接失败：") + message, "error");
      toast((i18n.isEnglish() ? "AI connection failed: " : "AI 连接失败：") + message, "error", 7000);
    }).then(function () {
      ui.aiTesting = false;
    });
  }

  function clearAiSettings() {
    if (!confirmAction(i18n.isEnglish() ? "Clear the AI connection? The saved API Key will be removed from this device." : "确认清除 AI 连接？已保存的 API Key 会从本机移除。")) return;
    aiProvider.clearSettings();
    var settings = aiProvider.getSettings();
    dom["ai-enabled"].checked = settings.enabled;
    dom["ai-provider"].value = settings.provider;
    dom["ai-api-key"].value = "";
    dom["ai-base-url"].value = settings.baseUrl;
    populateAiModelOptions(settings.model);
    updateAiUi();
    updateAiSettingsStatus(i18n.isEnglish() ? "AI connection cleared." : "已清除 AI 连接。", "ok");
    toast(i18n.isEnglish() ? "AI connection cleared" : "AI 连接已清除");
  }

  function handleNoteAiToggle() {
    var settings = aiProvider.getSettings();
    settings.noteAiEnabled = dom["note-ai-enabled"].checked;
    aiProvider.saveSettings(settings);
    updateAiUi();
    toast(
      dom["note-ai-enabled"].checked
        ? i18n.isEnglish() ? "AI conversion enabled in Notes" : "已开启随手记 AI 转换"
        : i18n.isEnglish() ? "AI conversion disabled in Notes" : "已关闭随手记 AI 转换"
    );
  }

  function updateAiUi() {
    var settings = aiProvider.getSettings();
    var enabled = aiProvider.isEnabled(settings);
    dom["note-ai-enabled"].checked = Boolean(settings.noteAiEnabled);
    dom["note-ai-enabled"].disabled = !enabled;
    dom["note-ai-rewrite-button"].disabled = !(enabled && settings.noteAiEnabled);
  }

  function closeAiOriginalPanel() {
    if (dom["note-ai-original-panel"]) dom["note-ai-original-panel"].hidden = true;
    if (dom["note-ai-original-content"]) dom["note-ai-original-content"].innerHTML = "";
    if (dom["note-editor-shell"]) dom["note-editor-shell"].classList.remove("is-comparing");
  }

  function hideAiOriginalPanel() {
    closeAiOriginalPanel();
  }

  function restoreAiOriginal() {
    if (!ui.aiOriginalHtml) {
      toast(i18n.isEnglish() ? "No original content to restore." : "当前没有可恢复的原文。", "warning");
      return;
    }
    dom["note-editor"].innerHTML = ui.aiOriginalHtml;
    markNoteDirty();
    ui.aiOriginalHtml = null;
    closeAiOriginalPanel();
    toast(i18n.isEnglish() ? "Original note restored." : "已恢复为改写前原文。");
  }

  function prepareAiRewritePayload(originalHtml) {
    var template = document.createElement("template");
    template.innerHTML = originalHtml;
    var tokenSeed = utils.uid("table").replace(/[^a-z0-9]/gi, "").toUpperCase();
    var tables = queryAll("table", template.content).filter(function (table) {
      return !(table.parentElement && table.parentElement.closest("table"));
    }).map(function (table, index) {
      var token = "[[WEEKFLOW_TABLE_" + tokenSeed + "_" + (index + 1) + "]]";
      var html = richText.sanitizeHtml(table.outerHTML, richText.MAX_NOTE_TEXT);
      var placeholder = document.createElement("p");
      placeholder.textContent = token;
      table.replaceWith(placeholder);
      return { token: token, html: html };
    });
    return {
      text: richText.plainText(template.innerHTML),
      tables: tables
    };
  }

  function restoreTablesIntoAiRewrite(result, tables) {
    var rewritten = String(result || "").replace(/\r\n/g, "\n");
    if (!tables.length) {
      return { ok: true, html: richText.fromPlainText(rewritten) };
    }
    var output = [];
    var cursor = 0;
    for (var index = 0; index < tables.length; index += 1) {
      var table = tables[index];
      var position = rewritten.indexOf(table.token, cursor);
      if (position < 0 || rewritten.indexOf(table.token, position + table.token.length) >= 0) {
        return { ok: false, reason: "table-token" };
      }
      output.push(richText.fromPlainText(rewritten.slice(cursor, position)));
      output.push(table.html);
      cursor = position + table.token.length;
    }
    for (var reverseIndex = 1; reverseIndex < tables.length; reverseIndex += 1) {
      if (rewritten.indexOf(tables[reverseIndex - 1].token) > rewritten.indexOf(tables[reverseIndex].token)) {
        return { ok: false, reason: "table-order" };
      }
    }
    output.push(richText.fromPlainText(rewritten.slice(cursor)));
    var combined = output.join("");
    if (richText.plainText(combined).length > richText.MAX_NOTE_TEXT) {
      return { ok: false, reason: "too-long" };
    }
    var sanitized = richText.sanitizeHtml(combined, richText.MAX_NOTE_TEXT);
    var verification = document.createElement("template");
    verification.innerHTML = sanitized;
    if (queryAll("table", verification.content).length !== tables.length) {
      return { ok: false, reason: "table-restore" };
    }
    return { ok: true, html: sanitized };
  }

  function aiRewriteCurrentNote() {
    var originalHtml = richText.sanitizeHtml(
      dom["note-editor"].innerHTML,
      richText.MAX_NOTE_TEXT
    );
    var rewritePayload = prepareAiRewritePayload(originalHtml);
    var contentText = rewritePayload.text;
    if (!contentText || !contentText.trim()) {
      toast(i18n.isEnglish() ? "The note is empty." : "笔记内容为空，无法改写。", "warning");
      return;
    }
    var settings = aiProvider.getSettings();
    if (!aiProvider.isEnabled(settings)) {
      toast(i18n.isEnglish() ? "Configure and enable AI first." : "请先在 AI 设置中接入并启用 AI。", "warning");
      return;
    }
    if (!settings.noteAiEnabled) {
      toast(i18n.isEnglish() ? "Enable AI conversion in Notes first." : "请在随手记界面开启 AI 转换。", "warning");
      return;
    }
    if (ui.aiRewriting) return;
    if (!confirmAction(i18n.isEnglish() ? "AI will rewrite this note without changing its meaning. Continue?" : "AI 将改写当前笔记内容，原意不变，但表达会被结构化。是否继续？")) return;
    var operation = {
      id: utils.uid("ai-rewrite"),
      noteId: ui.selectedNoteId || "",
      noteIsNew: ui.noteIsNew,
      originalHtml: originalHtml,
      tables: rewritePayload.tables
    };
    ui.aiRewriteOperation = operation;
    ui.aiRewriting = true;
    dom["note-ai-rewrite-button"].disabled = true;
    dom["note-ai-rewrite-button"].textContent = i18n.isEnglish() ? "Rewriting..." : "AI 改写中…";
    aiProvider.rewriteNote(contentText).then(function (result) {
      var currentHtml = richText.sanitizeHtml(
        dom["note-editor"].innerHTML,
        richText.MAX_NOTE_TEXT
      );
      if (
        ui.aiRewriteOperation !== operation ||
        (ui.selectedNoteId || "") !== operation.noteId ||
        ui.noteIsNew !== operation.noteIsNew ||
        currentHtml !== operation.originalHtml
      ) {
        toast(
          i18n.isEnglish()
            ? "The note changed while AI was rewriting it, so this result was not applied."
            : "AI 改写期间笔记内容或当前笔记已变化，本次结果未应用。",
          "warning",
          6000
        );
        return;
      }
      var restored = restoreTablesIntoAiRewrite(result, operation.tables);
      if (!restored.ok) {
        toast(
          i18n.isEnglish()
            ? "AI did not preserve every table position, so the rewrite was cancelled and your note was left unchanged."
            : "AI 未完整保留表格及其位置，本次改写已取消，原笔记未发生变化。",
          "warning",
          7000
        );
        return;
      }
      ui.aiOriginalHtml = originalHtml;
      dom["note-ai-original-content"].innerHTML = originalHtml;
      dom["note-ai-original-panel"].hidden = false;
      dom["note-editor-shell"].classList.add("is-comparing");
      dom["note-editor"].innerHTML = restored.html;
      hideNoteTableSelectHandle();
      clearNoteTableSelection();
      markNoteDirty();
      toast(i18n.isEnglish() ? "AI rewrite completed. Review and save." : "AI 改写完成，请检查后保存。");
    }).catch(function (error) {
      toast((i18n.isEnglish() ? "AI rewrite failed: " : "AI 改写失败：") + aiErrorMessage(error), "error", 7000);
    }).then(function () {
      if (ui.aiRewriteOperation === operation) ui.aiRewriteOperation = null;
      ui.aiRewriting = false;
      var current = aiProvider.getSettings();
      dom["note-ai-rewrite-button"].disabled = !(aiProvider.isEnabled(current) && current.noteAiEnabled);
      dom["note-ai-rewrite-button"].textContent = i18n.isEnglish() ? "AI Rewrite" : "AI 改写";
    });
  }

  function taskDraftParserContext() {
    return {
      groups: data.groups,
      flows: data.flows,
      reportToValues: collectTaskSuggestionValues("reportTo"),
      managedObjectValues: collectTaskSuggestionValues("managedObject"),
      referenceDate: new Date()
    };
  }

  function prepareTaskDraftCandidate(parsed) {
    return Object.assign({}, parsed || {}, {
      id: utils.uid("candidate"),
      status: "pending",
      taskId: null,
      form: null,
      recognizedFields: Array.isArray(parsed && parsed.recognizedFields)
        ? parsed.recognizedFields.slice()
        : [],
      suggestions: Array.isArray(parsed && parsed.suggestions)
        ? parsed.suggestions.slice()
        : []
    });
  }

  function startNoteTaskConversion() {
    var note = ensureCurrentNoteSaved();
    if (!note) return;
    if (!data.groups.length) {
      toast(i18n.isEnglish() ? "Create a Group before converting the note." : "请先创建分组，再转换 Task 草稿。", "warning");
      return;
    }
    var settings = aiProvider.getSettings();
    if (aiProvider.isEnabled(settings) && settings.noteAiEnabled) {
      if (ui.aiConverting) return;
      ui.aiConverting = true;
      toast(i18n.isEnglish() ? "AI is parsing Task drafts..." : "AI 正在解析 Task 草稿…", "info");
      var aiContext = taskDraftParserContext();
      aiContext.settings = settings;
      var localCandidates = taskDraftParser.parse(note.contentText, taskDraftParserContext()).map(prepareTaskDraftCandidate);
      aiProvider.parseTasks(note.contentText, aiContext).then(function (candidates) {
        if (!candidates.length) throw new Error("AI 未识别到 Task");
        openTaskDraftConversion(note, candidates.map(prepareTaskDraftCandidate));
        toast(i18n.isEnglish() ? "AI Task draft parsing completed" : "AI Task 草稿解析完成");
      }, function (error) {
        toast((i18n.isEnglish() ? "AI parsing failed, using local rules: " : "AI 解析失败，已改用本地规则解析：") + aiErrorMessage(error), "warning", 6000);
        openTaskDraftConversion(note, localCandidates);
      }).then(function () {
        ui.aiConverting = false;
      });
      return;
    }
    openTaskDraftConversion(
      note,
      taskDraftParser.parse(note.contentText, taskDraftParserContext()).map(prepareTaskDraftCandidate)
    );
  }

  function openTaskDraftConversion(note, candidates) {
    if (!Array.isArray(candidates) || !candidates.length) {
      toast(
        i18n.isEnglish()
          ? "No Task drafts were detected. Add clearer Task details and try again."
          : "未识别到 Task 草稿，请补充更明确的任务内容后重试。",
        "warning"
      );
      return false;
    }
    ui.taskDraftConversion = {
      noteId: note.id,
      currentIndex: 0,
      candidates: candidates,
      createdTaskIds: [],
      startedAt: new Date().toISOString()
    };
    dom["task-dialog"].classList.add("is-note-conversion");
    dom["task-draft-source-pane"].hidden = false;
    dom["task-draft-conversion-bar"].hidden = false;
    dom["task-draft-recognition"].hidden = false;
    dom["task-draft-skip-button"].hidden = false;
    dom["task-draft-complete-button"].hidden = false;
    dom["task-draft-source-title"].textContent = note.title;
    dom["task-draft-source-content"].innerHTML = note.contentHtml;
    dom["task-dialog-cancel-button"].textContent = i18n.isEnglish() ? "Exit Conversion" : "退出转换";
    loadTaskDraftCandidate(0);
    dom["task-dialog"].showModal();
    return true;
  }

  function currentTaskDraftCandidate() {
    var conversion = ui.taskDraftConversion;
    return conversion ? conversion.candidates[conversion.currentIndex] : null;
  }

  function captureTaskDraftForm() {
    var candidate = currentTaskDraftCandidate();
    if (!candidate) return;
    candidate.form = {
      taskName: dom["task-name"].value,
      groupId: dom["task-group"].value,
      flowId: dom["task-flow"].value === "__new_flow__" ? "" : dom["task-flow"].value,
      ddl: dom["task-ddl"].value,
      recurrenceCadence: dom["task-recurrence"].value,
      recurrenceStart: dom["task-recurrence-start"].value,
      recurrenceEnd: dom["task-recurrence-end"].value,
      urgency: dom["task-urgency"].value,
      reportTo: dom["task-report-to"].value,
      managedObject: dom["task-managed-object"].value,
      deliverable: dom["task-deliverable"].value,
      materials: utils.clone(ui.taskDraftMaterials)
    };
  }

  function taskDraftFormSource(candidate) {
    if (candidate.taskId) {
      var task = getTask(candidate.taskId);
      if (task) {
        return {
          taskName: task.name,
          groupId: task.groupId,
          flowId: task.flowId || "",
          ddl: task.ddl,
          recurrenceCadence: dates.recurrenceCadence(task),
          recurrenceStart: task.recurrenceStart || "",
          recurrenceEnd: task.recurrenceEnd || "",
          urgency: task.urgency,
          reportTo: task.reportTo,
          managedObject: task.managedObject,
          deliverable: task.deliverable,
          materials: utils.clone(getTaskMaterials(task.id))
        };
      }
    }
    return candidate.form || {
      taskName: candidate.taskName || "",
      groupId: candidate.groupId || "",
      flowId: candidate.flowId || "",
      ddl: candidate.ddl || "",
      recurrenceCadence: candidate.recurrenceCadence || "none",
      recurrenceStart: candidate.recurrenceStart || "",
      recurrenceEnd: candidate.recurrenceEnd || "",
      urgency: candidate.urgency || "",
      reportTo: candidate.reportTo || "",
      managedObject: candidate.managedObject || "",
      deliverable: candidate.deliverable || "",
      materials: []
    };
  }

  function loadTaskDraftCandidate(index) {
    var conversion = ui.taskDraftConversion;
    if (!conversion || !conversion.candidates.length) return;
    conversion.currentIndex = Math.max(0, Math.min(index, conversion.candidates.length - 1));
    var candidate = currentTaskDraftCandidate();
    var source = taskDraftFormSource(candidate);
    clearFieldErrors(dom["task-form"]);
    dom["task-dialog-title"].textContent = candidate.taskId
      ? i18n.isEnglish()
        ? "Review Created Task"
        : "复核已创建 Task"
      : i18n.isEnglish()
        ? "Confirm Task Draft"
        : "确认 Task 草稿";
    dom["task-id"].value = candidate.taskId || "";
    dom["task-name"].value = source.taskName;
    var validGroup = getGroup(source.groupId);
    populateTaskGroupSelect(validGroup ? source.groupId : "", true);
    populateTaskFlowSelect(validGroup ? source.groupId : "", source.flowId);
    dom["task-ddl"].value = source.ddl;
    dom["task-recurrence"].value = ["none", "weekly", "monthly"].includes(source.recurrenceCadence)
      ? source.recurrenceCadence
      : "none";
    dom["task-recurrence-start"].value = source.recurrenceStart;
    dom["task-recurrence-end"].value = source.recurrenceEnd;
    dom["task-urgency"].value = source.urgency;
    dom["task-status"].value = "pending";
    dom["task-completed-at"].value = "";
    syncTaskRecurrenceFields();
    dom["task-report-to"].value = source.reportTo;
    dom["task-managed-object"].value = source.managedObject;
    dom["task-deliverable"].value = source.deliverable;
    dom["task-delete-button"].hidden = true;
    ui.taskDraftMaterials = utils.clone(source.materials || []);
    renderDraftMaterials();
    dom["task-save-button"].textContent = candidate.taskId
      ? i18n.isEnglish()
        ? "Update & Continue"
        : "更新并继续"
      : i18n.isEnglish()
        ? "Save & Continue"
        : "保存并继续";
    renderTaskDraftConversionState();
    setTimeout(function () { dom["task-name"].focus(); }, 0);
  }

  function taskDraftFieldLabel(field) {
    var labels = i18n.isEnglish()
      ? {
          taskName: "Task Name", group: "Group", flow: "Flow", ddl: "DDL",
          recurrence: "Recurrence", urgency: "Urgency", reportTo: "Report To",
          managedObject: "Managed Person", deliverable: "Deliverable"
        }
      : {
          taskName: "Task name", group: "分组", flow: "Flow", ddl: "DDL",
          recurrence: "周期", urgency: "紧急程度", reportTo: "汇报对象",
          managedObject: "管理对象", deliverable: "交付物"
        };
    return labels[field] || field;
  }

  function renderTaskDraftRecognition(candidate) {
    var recognized = (candidate.recognizedFields || []).map(taskDraftFieldLabel);
    var messages = [];
    if (recognized.length) {
      messages.push(
        (i18n.isEnglish() ? "Prefilled: " : "已预填：") + recognized.join("、")
      );
    } else {
      messages.push(
        i18n.isEnglish()
          ? "No reliable fields were detected. Complete the required fields manually."
          : "未识别到可可靠预填的字段，请根据原笔记补充必填信息。"
      );
    }
    (candidate.suggestions || []).forEach(function (suggestion) {
      if (suggestion.field === "ddlCalculated") {
        messages.push(
          i18n.isEnglish()
            ? "Calculated date “" + suggestion.value + "” from “" + suggestion.source + "”; please confirm."
            : "根据“" + suggestion.source + "”推算日期为 " + suggestion.value + "，请确认。"
        );
      } else {
        messages.push(
          (i18n.isEnglish() ? "Possible " : "可能的") +
            taskDraftFieldLabel(suggestion.field) +
            (i18n.isEnglish() ? ": " : "：") +
            suggestion.value +
            (i18n.isEnglish() ? " (not auto-filled)" : "（未自动填入）")
        );
      }
    });
    dom["task-draft-recognition"].textContent = messages.join(" · ");
  }

  function renderTaskDraftConversionState() {
    var conversion = ui.taskDraftConversion;
    if (!conversion) return;
    var candidate = currentTaskDraftCandidate();
    var counts = conversion.candidates.reduce(
      function (result, item) {
        result[item.status] = (result[item.status] || 0) + 1;
        return result;
      },
      { pending: 0, saved: 0, skipped: 0 }
    );
    dom["task-draft-position"].textContent = i18n.isEnglish()
      ? "Detected " + conversion.candidates.length + " potential Tasks · Editing " + (conversion.currentIndex + 1)
      : "识别到 " + conversion.candidates.length + " 个潜在 Task，正在编辑第 " + (conversion.currentIndex + 1) + " 个";
    dom["task-draft-status-summary"].textContent = i18n.isEnglish()
      ? counts.pending + " pending · " + counts.saved + " saved · " + counts.skipped + " skipped"
      : counts.pending + " 个待处理 · " + counts.saved + " 个已保存 · " + counts.skipped + " 个已跳过";
    var navButtons = queryAll(".task-draft-nav-actions button", dom["task-draft-conversion-bar"]);
    if (navButtons[0]) navButtons[0].disabled = conversion.currentIndex === 0;
    if (navButtons[1]) navButtons[1].disabled = conversion.currentIndex === conversion.candidates.length - 1;
    dom["task-draft-skip-button"].disabled = candidate.status === "saved";
    dom["task-draft-skip-button"].textContent = candidate.status === "saved"
      ? i18n.isEnglish()
        ? "Saved"
        : "已保存"
      : candidate.status === "skipped"
        ? i18n.isEnglish()
          ? "Restore This Draft"
          : "恢复此草稿"
        : i18n.isEnglish()
          ? "Skip This Draft"
          : "跳过此项";
    dom["task-draft-complete-button"].disabled = counts.pending > 0;
    renderTaskDraftRecognition(candidate);
  }

  function moveTaskDraftCandidate(direction) {
    var conversion = ui.taskDraftConversion;
    if (!conversion) return;
    captureTaskDraftForm();
    loadTaskDraftCandidate(conversion.currentIndex + direction);
  }

  function selectedTaskDraftSourceText() {
    var selection = window.getSelection && window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return "";
    var range = selection.getRangeAt(0);
    return dom["task-draft-source-content"].contains(range.commonAncestorContainer)
      ? selection.toString().trim()
      : "";
  }

  function addTaskDraftCandidate() {
    var conversion = ui.taskDraftConversion;
    if (!conversion) return;
    captureTaskDraftForm();
    var selectedText = selectedTaskDraftSourceText();
    var parsed = taskDraftParser.parseSingle(selectedText, taskDraftParserContext());
    if (!selectedText) {
      parsed.sourceText = "";
      parsed.taskName = "";
      parsed.groupId = "";
      parsed.groupName = "";
      parsed.flowId = "";
      parsed.flowName = "";
      parsed.ddl = "";
      parsed.recurrenceCadence = "none";
      parsed.recurrenceStart = "";
      parsed.recurrenceEnd = "";
      parsed.urgency = "";
      parsed.reportTo = "";
      parsed.managedObject = "";
      parsed.deliverable = "";
      parsed.recognizedFields = [];
      parsed.suggestions = [];
    }
    conversion.candidates.push(prepareTaskDraftCandidate(parsed));
    loadTaskDraftCandidate(conversion.candidates.length - 1);
    toast(
      selectedText
        ? i18n.isEnglish()
          ? "A Task draft was added from the selected text."
          : "已根据选中的原文增加 Task 草稿。"
        : i18n.isEnglish()
          ? "A blank Task draft was added."
          : "已增加一个空白 Task 草稿。"
    );
  }

  function skipTaskDraftCandidate() {
    var conversion = ui.taskDraftConversion;
    var candidate = currentTaskDraftCandidate();
    if (!conversion || !candidate) return;
    captureTaskDraftForm();
    candidate.status = candidate.status === "skipped" ? "pending" : "skipped";
    if (candidate.status === "skipped") {
      var nextPending = conversion.candidates.findIndex(function (item, index) {
        return index > conversion.currentIndex && item.status === "pending";
      });
      if (nextPending >= 0) {
        loadTaskDraftCandidate(nextPending);
        return;
      }
    }
    renderTaskDraftConversionState();
  }

  function nextPendingTaskDraftIndex() {
    var conversion = ui.taskDraftConversion;
    if (!conversion) return -1;
    for (var index = conversion.currentIndex + 1; index < conversion.candidates.length; index += 1) {
      if (conversion.candidates[index].status === "pending") return index;
    }
    for (var previous = 0; previous < conversion.currentIndex; previous += 1) {
      if (conversion.candidates[previous].status === "pending") return previous;
    }
    return -1;
  }

  function resetTaskDraftConversionUi() {
    ui.taskDraftConversion = null;
    dom["task-dialog"].classList.remove("is-note-conversion");
    dom["task-draft-source-pane"].hidden = true;
    dom["task-draft-conversion-bar"].hidden = true;
    dom["task-draft-recognition"].hidden = true;
    dom["task-draft-skip-button"].hidden = true;
    dom["task-draft-skip-button"].disabled = false;
    dom["task-draft-complete-button"].hidden = true;
    dom["task-dialog-cancel-button"].textContent = i18n.isEnglish() ? "Cancel" : "取消";
    dom["task-save-button"].textContent = i18n.isEnglish() ? "Save Task" : "保存 Task";
  }

  function completeTaskDraftConversion() {
    var conversion = ui.taskDraftConversion;
    if (!conversion) return;
    var pending = conversion.candidates.filter(function (candidate) { return candidate.status === "pending"; });
    if (pending.length) {
      toast(
        i18n.isEnglish()
          ? "Save or skip every Task draft before completing the conversion."
          : "请先保存或明确跳过全部 Task 草稿。",
        "warning"
      );
      return;
    }
    var note = getNote(conversion.noteId);
    var stamp = new Date().toISOString();
    if (note) {
      note.conversions.push({
        id: utils.uid("conversion"),
        type: "task",
        taskIds: conversion.createdTaskIds.slice(),
        progressEntryIds: [],
        skippedCount: conversion.candidates.filter(function (candidate) { return candidate.status === "skipped"; }).length,
        createdAt: stamp
      });
      note.updatedAt = stamp;
    }
    dom["task-dialog"].close();
    resetTaskDraftConversionUi();
    persistAndRender(
      i18n.isEnglish()
        ? "Task draft conversion completed"
        : "Task 草稿转换已完成"
    );
  }

  function requestCloseTaskDialog() {
    if (ui.taskDraftConversion) {
      var created = ui.taskDraftConversion.createdTaskIds.length;
      var message = created
        ? "退出后，已保存的 " + created + " 个 Task 会保留，其余草稿不会创建。确认退出？"
        : "Task 草稿转换尚未完成，确认退出？";
      if (!confirmAction(message)) return;
      resetTaskDraftConversionUi();
    }
    dom["task-dialog"].close();
  }

  function handleTaskDialogCancel(event) {
    event.preventDefault();
    requestCloseTaskDialog();
  }

  function openNewGroup() {
    clearFieldErrors(dom["group-form"]);
    dom["group-dialog-title"].textContent = i18n.isEnglish() ? "New Group" : "新建分组";
    dom["group-id"].value = "";
    dom["group-name"].value = "";
    var color = storage.nextGroupColor(data.groups);
    dom["group-color"].value = color;
    dom["group-color-value"].textContent = color;
    dom["group-delete-button"].hidden = true;
    dom["group-dialog"].showModal();
    setTimeout(function () {
      dom["group-name"].focus();
    }, 0);
  }

  function openEditGroup(groupId) {
    var group = getGroup(groupId);
    if (!group) return;
    clearFieldErrors(dom["group-form"]);
    dom["group-dialog-title"].textContent = i18n.isEnglish() ? "Edit Group" : "编辑分组";
    dom["group-id"].value = group.id;
    dom["group-name"].value = group.name;
    dom["group-color"].value = group.color;
    dom["group-color-value"].textContent = group.color;
    dom["group-delete-button"].hidden = false;
    dom["group-dialog"].showModal();
    setTimeout(function () {
      dom["group-name"].focus();
      dom["group-name"].select();
    }, 0);
  }

  function saveGroupFromForm(event) {
    event.preventDefault();
    clearFieldErrors(dom["group-form"]);
    var id = dom["group-id"].value;
    var name = dom["group-name"].value.trim();
    var color = dom["group-color"].value.toUpperCase();
    if (!name) {
      setFieldError("group-name", "请输入分组名称。");
      dom["group-name"].focus();
      return;
    }
    var duplicate = data.groups.some(function (group) {
      return group.id !== id && group.name.toLocaleLowerCase() === name.toLocaleLowerCase();
    });
    if (duplicate) {
      setFieldError("group-name", "已有同名分组，请使用其他名称。");
      return;
    }
    dom["group-save-button"].disabled = true;
    var stamp = new Date().toISOString();
    if (id) {
      var group = getGroup(id);
      if (!group) return;
      group.name = name;
      group.color = color;
      group.updatedAt = stamp;
    } else {
      data.groups.push({
        id: utils.uid("group"),
        name: name,
        color: color,
        order: data.groups.length
          ? Math.max.apply(
              null,
              data.groups.map(function (group) {
                return Number(group.order || 0);
              })
            ) + 1
          : 1,
        collapsed: false,
        createdAt: stamp,
        updatedAt: stamp
      });
    }
    if (persistAndRender(id ? "分组已更新" : "分组已创建")) dom["group-dialog"].close();
    dom["group-save-button"].disabled = false;
  }

  function populateFlowGroupSelect(selectedId) {
    var select = utils.clear(dom["flow-group"]);
    getSortedGroups().forEach(function (group) {
      var option = utils.el("option", "", group.name);
      option.value = group.id;
      option.selected = group.id === selectedId;
      select.appendChild(option);
    });
  }

  function setFlowColor(color) {
    var normalized = utils.isHexColor(color) ? color.toUpperCase() : "#5368D8";
    dom["flow-color"].value = normalized;
    dom["flow-color-value"].textContent = normalized;
  }

  function syncFlowColorWithSelectedGroup() {
    if (ui.flowColorCustomized) return;
    var group = getGroup(dom["flow-group"].value);
    if (group) setFlowColor(group.color);
  }

  function openNewFlow(groupId, returnToTask) {
    if (!data.groups.length) {
      toast("请先新建一个分组，再创建 Flow。", "warning");
      openNewGroup();
      return;
    }
    clearFieldErrors(dom["flow-form"]);
    ui.flowCreationForTask = Boolean(returnToTask);
    ui.flowColorCustomized = false;
    ui.draggedFlowTaskId = null;
    dom["flow-dialog-title"].textContent = i18n.isEnglish() ? "New Flow" : "新建 Flow";
    dom["flow-id"].value = "";
    dom["flow-name"].value = "";
    var activeFlow = getFlow(ui.filters.flowId);
    var selectedGroupId =
      groupId ||
      (activeFlow
        ? activeFlow.groupId
        : ui.filters.groupIds.length === 1
          ? ui.filters.groupIds[0]
          : data.groups[0].id);
    populateFlowGroupSelect(selectedGroupId);
    syncFlowColorWithSelectedGroup();
    dom["flow-delete-button"].hidden = true;
    renderFlowTaskOrder(null);
    dom["flow-dialog"].showModal();
    setTimeout(function () {
      dom["flow-name"].focus();
    }, 0);
  }

  function openEditFlow(flowId) {
    var flow = getFlow(flowId);
    if (!flow) return;
    clearFieldErrors(dom["flow-form"]);
    ui.flowCreationForTask = false;
    ui.draggedFlowTaskId = null;
    dom["flow-dialog-title"].textContent = i18n.isEnglish() ? "Edit Flow" : "编辑 Flow";
    dom["flow-id"].value = flow.id;
    dom["flow-name"].value = flow.name;
    populateFlowGroupSelect(flow.groupId);
    var ownerGroup = getGroup(flow.groupId);
    ui.flowColorCustomized = Boolean(
      !ownerGroup || flow.color.toUpperCase() !== ownerGroup.color.toUpperCase()
    );
    setFlowColor(flow.color);
    dom["flow-delete-button"].hidden = false;
    renderFlowTaskOrder(flow.id);
    dom["flow-dialog"].showModal();
    setTimeout(function () {
      dom["flow-name"].focus();
      dom["flow-name"].select();
    }, 0);
  }

  function closeFlowDialog() {
    ui.flowCreationForTask = false;
    ui.flowColorCustomized = false;
    ui.draggedFlowTaskId = null;
    dom["flow-dialog"].close();
  }

  function renderFlowTaskOrder(flowId) {
    var container = utils.clear(dom["flow-task-order-list"]);
    var flowTasks = flowId
      ? stats.sortFlowTasks(
          data.tasks.filter(function (task) {
            return task.flowId === flowId;
          }),
          new Date()
        )
      : [];
    dom["flow-task-count"].textContent = i18n.isEnglish()
      ? flowTasks.length + " steps"
      : flowTasks.length + " 个步骤";
    if (!flowTasks.length) {
      container.appendChild(
        utils.el(
          "p",
          "flow-order-empty",
          i18n.isEnglish()
            ? flowId
              ? "No steps yet. Add a Task to this Flow while creating or editing it."
              : "After creating the Flow, add Tasks to it and reorder them here."
            : flowId
              ? "暂无步骤。可在新建或编辑 Task 时把它加入此 Flow。"
              : "Flow 创建后，可在 Task 中选择加入并在这里拖动排序。"
        )
      );
      return;
    }
    flowTasks.forEach(function (task, index) {
      var item = utils.el("div", "flow-order-item");
      item.dataset.taskId = task.id;
      item.draggable = true;
      var handle = utils.el("span", "flow-drag-handle", "⠿");
      handle.title = i18n.isEnglish() ? "Drag to reorder" : "拖动调整顺序";
      handle.setAttribute("aria-hidden", "true");
      var number = utils.el(
        "span",
        "flow-order-number",
        "STEP " + String(index + 1).padStart(2, "0")
      );
      number.dataset.flowStepNumber = "true";
      var copy = utils.el("span", "flow-order-copy");
      copy.append(
        utils.el("strong", "", task.name),
        utils.el("small", "", "DDL " + task.ddl + " · " + statusLabels[task.status])
      );
      var controls = utils.el("span", "flow-order-controls");
      var up = utils.el("button", "", "↑");
      up.type = "button";
      up.title = i18n.isEnglish() ? "Move up" : "上移";
      up.setAttribute("aria-label", (i18n.isEnglish() ? "Move up " : "上移 ") + task.name);
      up.disabled = index === 0;
      up.addEventListener("click", function () {
        moveFlowOrderItem(item, -1);
      });
      var down = utils.el("button", "", "↓");
      down.type = "button";
      down.title = i18n.isEnglish() ? "Move down" : "下移";
      down.setAttribute("aria-label", (i18n.isEnglish() ? "Move down " : "下移 ") + task.name);
      down.disabled = index === flowTasks.length - 1;
      down.addEventListener("click", function () {
        moveFlowOrderItem(item, 1);
      });
      controls.append(up, down);
      item.append(handle, number, copy, controls);
      item.addEventListener("dragstart", function (event) {
        ui.draggedFlowTaskId = task.id;
        item.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
      });
      item.addEventListener("dragover", function (event) {
        event.preventDefault();
        var dragging = query(".flow-order-item.is-dragging", container);
        if (!dragging || dragging === item) return;
        var rect = item.getBoundingClientRect();
        var placeAfter = event.clientY > rect.top + rect.height / 2;
        container.insertBefore(dragging, placeAfter ? item.nextSibling : item);
        refreshFlowOrderLabels();
      });
      item.addEventListener("drop", function (event) {
        event.preventDefault();
        refreshFlowOrderLabels();
      });
      item.addEventListener("dragend", function () {
        item.classList.remove("is-dragging");
        ui.draggedFlowTaskId = null;
        refreshFlowOrderLabels();
      });
      container.appendChild(item);
    });
  }

  function moveFlowOrderItem(item, direction) {
    var container = dom["flow-task-order-list"];
    if (direction < 0 && item.previousElementSibling) {
      container.insertBefore(item, item.previousElementSibling);
    } else if (direction > 0 && item.nextElementSibling) {
      container.insertBefore(item.nextElementSibling, item);
    }
    refreshFlowOrderLabels();
  }

  function refreshFlowOrderLabels() {
    var items = queryAll(".flow-order-item", dom["flow-task-order-list"]);
    items.forEach(function (item, index) {
      var number = query("[data-flow-step-number]", item);
      if (number) number.textContent = "STEP " + String(index + 1).padStart(2, "0");
      var buttons = queryAll("button", item);
      if (buttons[0]) buttons[0].disabled = index === 0;
      if (buttons[1]) buttons[1].disabled = index === items.length - 1;
    });
    dom["flow-task-count"].textContent = i18n.isEnglish()
      ? items.length + " steps"
      : items.length + " 个步骤";
  }

  function saveFlowFromForm(event) {
    event.preventDefault();
    clearFieldErrors(dom["flow-form"]);
    var id = dom["flow-id"].value;
    var name = dom["flow-name"].value.trim();
    var groupId = dom["flow-group"].value;
    var color = dom["flow-color"].value.toUpperCase();
    if (!name) {
      setFieldError("flow-name", "请输入 Flow 名称。");
      dom["flow-name"].focus();
      return;
    }
    if (!getGroup(groupId)) {
      setFieldError("flow-group", "请选择有效分组。");
      return;
    }
    var duplicate = data.flows.some(function (flow) {
      return (
        flow.id !== id &&
        flow.groupId === groupId &&
        flow.name.toLocaleLowerCase() === name.toLocaleLowerCase()
      );
    });
    if (duplicate) {
      setFieldError("flow-name", "该分组中已有同名 Flow。");
      return;
    }
    dom["flow-save-button"].disabled = true;
    var stamp = new Date().toISOString();
    var flow = id ? getFlow(id) : null;
    if (id && !flow) {
      dom["flow-save-button"].disabled = false;
      toast("Flow 不存在，无法保存。", "error");
      return;
    }
    if (flow) {
      var groupChanged = flow.groupId !== groupId;
      flow.name = name;
      flow.groupId = groupId;
      flow.color = color;
      if (groupChanged) {
        var targetOrders = data.flows
          .filter(function (item) {
            return item.id !== flow.id && item.groupId === groupId;
          })
          .map(function (item) {
            return Number(item.order || 0);
          });
        flow.order = targetOrders.length ? Math.max.apply(null, targetOrders) + 1 : 1;
      }
      flow.updatedAt = stamp;
    } else {
      flow = {
        id: utils.uid("flow"),
        groupId: groupId,
        name: name,
        color: color,
        order: getSortedFlows(groupId).length
          ? Math.max.apply(
              null,
              getSortedFlows(groupId).map(function (item) {
                return Number(item.order || 0);
              })
            ) + 1
          : 1,
        collapsed: false,
        createdAt: stamp,
        updatedAt: stamp
      };
      data.flows.push(flow);
    }
    var orderedTaskIds = queryAll(".flow-order-item", dom["flow-task-order-list"]).map(
      function (item) {
        return item.dataset.taskId;
      }
    );
    orderedTaskIds.forEach(function (taskId, index) {
      var task = getTask(taskId);
      if (!task || task.flowId !== flow.id) return;
      task.groupId = groupId;
      task.flowOrder = index + 1;
      task.updatedAt = stamp;
    });
    data.tasks.forEach(function (task) {
      if (task.flowId === flow.id) {
        task.groupId = groupId;
        task.updatedAt = stamp;
      }
    });
    var returnToTask = ui.flowCreationForTask;
    if (persistAndRender(id ? "Flow 已更新" : "Flow 已创建")) {
      dom["flow-dialog"].close();
      ui.flowCreationForTask = false;
      if (returnToTask && dom["task-dialog"].open) {
        populateTaskFlowSelect(groupId, flow.id);
      }
    }
    dom["flow-save-button"].disabled = false;
  }

  function requestDeleteCurrentFlow() {
    var flowId = dom["flow-id"].value;
    var flow = getFlow(flowId);
    if (!flow) return;
    var flowTasks = data.tasks.filter(function (task) {
      return task.flowId === flowId;
    });
    var message = flowTasks.length
      ? "确认删除 Flow「" +
        flow.name +
        "」？其中 " +
        flowTasks.length +
        " 条 Task 会保留在原分组并取消 Flow 归属。"
      : "确认删除 Flow「" + flow.name + "」？";
    if (!confirmAction(message)) return;
    var stamp = new Date().toISOString();
    flowTasks.forEach(function (task) {
      task.flowId = null;
      task.flowOrder = null;
      task.updatedAt = stamp;
    });
    data.flows = data.flows.filter(function (item) {
      return item.id !== flowId;
    });
    data.materials.forEach(function (material) {
      material.flowIds = material.flowIds.filter(function (id) {
        return id !== flowId;
      });
    });
    dom["flow-dialog"].close();
    ui.flowCreationForTask = false;
    persistAndRender("Flow 已删除，原步骤已保留为普通 Task");
  }

  function requestDeleteCurrentGroup() {
    var groupId = dom["group-id"].value;
    var group = getGroup(groupId);
    if (!group) return;
    var groupTasks = data.tasks.filter(function (task) {
      return task.groupId === groupId;
    });
    var groupFlows = data.flows.filter(function (flow) {
      return flow.groupId === groupId;
    });
    if (!groupTasks.length) {
      var emptyGroupMessage =
        "确认删除分组「" +
        group.name +
        "」" +
        (groupFlows.length ? "及其中 " + groupFlows.length + " 个空 Flow" : "") +
        "？此操作不可恢复。";
      if (!confirmAction(emptyGroupMessage)) return;
      data.groups = data.groups.filter(function (item) {
        return item.id !== groupId;
      });
      data.flows = data.flows.filter(function (flow) {
        return flow.groupId !== groupId;
      });
      var removedFlowIds = new Set(
        groupFlows.map(function (flow) {
          return flow.id;
        })
      );
      data.materials.forEach(function (material) {
        material.groupIds = material.groupIds.filter(function (id) {
          return id !== groupId;
        });
        material.flowIds = material.flowIds.filter(function (id) {
          return !removedFlowIds.has(id);
        });
      });
      dom["group-dialog"].close();
      persistAndRender("分组已删除");
      return;
    }
    ui.deletingGroupId = groupId;
    dom["delete-group-message"].textContent =
      "「" +
      group.name +
      "」中有 " +
      groupTasks.length +
      " 条 Task 和 " +
      groupFlows.length +
      " 个 Flow。移动时会保留 Flow 与步骤顺序。";
    var select = utils.clear(dom["delete-group-target"]);
    data.groups
      .filter(function (item) {
        return item.id !== groupId;
      })
      .forEach(function (item) {
        var option = utils.el("option", "", item.name);
        option.value = item.id;
        select.appendChild(option);
      });
    var moveButton = query('[data-action="move-and-delete-group"]', dom["delete-group-dialog"]);
    moveButton.disabled = select.options.length === 0;
    dom["group-dialog"].close();
    dom["delete-group-dialog"].showModal();
  }

  function cancelGroupDelete() {
    ui.deletingGroupId = null;
    dom["delete-group-dialog"].close();
  }

  function moveTasksAndDeleteGroup() {
    var groupId = ui.deletingGroupId;
    var targetId = dom["delete-group-target"].value;
    var group = getGroup(groupId);
    var target = getGroup(targetId);
    if (!group || !target) {
      toast("无法移动 Task 与 Flow：目标分组不存在。", "error");
      return;
    }
    if (
      !confirmAction(
        "确认将「" +
          group.name +
          "」内的 Task 与 Flow 移动到「" +
          target.name +
          "」并删除原分组？"
      )
    ) {
      return;
    }
    data.tasks.forEach(function (task) {
      if (task.groupId === groupId) {
        task.groupId = targetId;
        task.updatedAt = new Date().toISOString();
      }
    });
    var targetFlowOrders = data.flows
      .filter(function (flow) {
        return flow.groupId === targetId;
      })
      .map(function (flow) {
        return Number(flow.order || 0);
      });
    var nextTargetFlowOrder = targetFlowOrders.length
      ? Math.max.apply(null, targetFlowOrders) + 1
      : 1;
    data.flows
      .filter(function (flow) {
        return flow.groupId === groupId;
      })
      .sort(function (left, right) {
        return Number(left.order || 0) - Number(right.order || 0);
      })
      .forEach(function (flow) {
        flow.name = uniqueFlowNameForGroup(flow.name, targetId, flow.id, group.name);
        flow.groupId = targetId;
        flow.order = nextTargetFlowOrder;
        nextTargetFlowOrder += 1;
        flow.updatedAt = new Date().toISOString();
      });
    data.groups = data.groups.filter(function (item) {
      return item.id !== groupId;
    });
    data.materials.forEach(function (material) {
      material.groupIds = materialTools.uniqueIds(
        material.groupIds.map(function (id) {
          return id === groupId ? targetId : id;
        })
      );
    });
    cancelGroupDelete();
    persistAndRender("Task 与 Flow 已移动，原分组已删除");
  }

  function uniqueFlowNameForGroup(name, groupId, excludeId, sourceGroupName) {
    var base = name;
    var candidate = base;
    var suffix = 1;
    function exists(value) {
      return data.flows.some(function (flow) {
        return (
          flow.id !== excludeId &&
          flow.groupId === groupId &&
          flow.name.toLocaleLowerCase() === value.toLocaleLowerCase()
        );
      });
    }
    if (exists(candidate)) {
      base = name + "（来自" + sourceGroupName + "）";
      candidate = base;
    }
    while (exists(candidate)) {
      suffix += 1;
      candidate = base + " " + suffix;
    }
    return candidate;
  }

  function deleteGroupWithTasks() {
    var groupId = ui.deletingGroupId;
    var group = getGroup(groupId);
    if (!group) return;
    var count = data.tasks.filter(function (task) {
      return task.groupId === groupId;
    }).length;
    var flowCount = data.flows.filter(function (flow) {
      return flow.groupId === groupId;
    }).length;
    if (
      !confirmAction(
        "最终确认：删除分组「" +
          group.name +
          "」、其中 " +
          flowCount +
          " 个 Flow 和 " +
          count +
          " 条 Task？此操作不可恢复。"
      )
    ) {
      return;
    }
    var removedTaskIds = new Set(
      data.tasks
        .filter(function (task) {
          return task.groupId === groupId;
        })
        .map(function (task) {
          return task.id;
        })
    );
    var removedFlowIds = new Set(
      data.flows
        .filter(function (flow) {
          return flow.groupId === groupId;
        })
        .map(function (flow) {
          return flow.id;
        })
    );
    data.tasks = data.tasks.filter(function (task) {
      return task.groupId !== groupId;
    });
    data.groups = data.groups.filter(function (item) {
      return item.id !== groupId;
    });
    data.flows = data.flows.filter(function (flow) {
      return flow.groupId !== groupId;
    });
    data.materials.forEach(function (material) {
      material.taskIds = material.taskIds.filter(function (id) {
        return !removedTaskIds.has(id);
      });
      material.flowIds = material.flowIds.filter(function (id) {
        return !removedFlowIds.has(id);
      });
      material.groupIds = material.groupIds.filter(function (id) {
        return id !== groupId;
      });
    });
    cancelGroupDelete();
    persistAndRender("分组及其中 Flow、Task 已删除");
  }

  function populateTaskGroupSelect(selectedId, allowBlank) {
    var select = utils.clear(dom["task-group"]);
    if (allowBlank) {
      var placeholder = utils.el(
        "option",
        "",
        i18n.isEnglish() ? "Select a Group" : "请选择分组"
      );
      placeholder.value = "";
      placeholder.selected = !selectedId;
      select.appendChild(placeholder);
    }
    getSortedGroups().forEach(function (group) {
      var option = utils.el("option", "", group.name);
      option.value = group.id;
      option.selected = group.id === selectedId;
      select.appendChild(option);
    });
  }

  function normalizeTaskSuggestionValue(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function collectTaskSuggestionValues(fieldName) {
    var seen = new Set();
    return data.tasks
      .map(function (task) {
        return normalizeTaskSuggestionValue(task[fieldName]);
      })
      .filter(function (value) {
        if (!value) return false;
        var key = value.toLocaleLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(function (left, right) {
        return left.localeCompare(right, i18n.locale(), { sensitivity: "base", numeric: true });
      });
  }

  function renderTaskSuggestionOptions() {
    [
      ["task-report-to-options", "reportTo"],
      ["task-managed-object-options", "managedObject"]
    ].forEach(function (config) {
      var list = utils.clear(dom[config[0]]);
      collectTaskSuggestionValues(config[1]).forEach(function (value) {
        var option = utils.el("option");
        option.value = value;
        list.appendChild(option);
      });
    });
  }

  function canonicalTaskSuggestionValue(fieldName, value) {
    var normalized = normalizeTaskSuggestionValue(value);
    if (!normalized) return "";
    var key = normalized.toLocaleLowerCase();
    return (
      collectTaskSuggestionValues(fieldName).find(function (existing) {
        return existing.toLocaleLowerCase() === key;
      }) || normalized
    );
  }

  function populateTaskFlowSelect(groupId, selectedFlowId) {
    var select = utils.clear(dom["task-flow"]);
    var none = utils.el("option", "", i18n.isEnglish() ? "No Flow" : "不加入 Flow");
    none.value = "";
    select.appendChild(none);
    getSortedFlows(groupId).forEach(function (flow) {
      var taskCount = data.tasks.filter(function (task) {
        return task.flowId === flow.id;
      }).length;
      var option = utils.el(
        "option",
        "",
        flow.name + " · " + taskCount + (i18n.isEnglish() ? " steps" : " 个步骤")
      );
      option.value = flow.id;
      select.appendChild(option);
    });
    var create = utils.el("option", "", i18n.isEnglish() ? "+ Create New Flow…" : "＋ 创建新的 Flow…");
    create.value = "__new_flow__";
    select.appendChild(create);
    select.value = selectedFlowId || "";
    if (select.value !== (selectedFlowId || "")) select.value = "";
  }

  function handleTaskFlowSelection() {
    if (dom["task-flow"].value !== "__new_flow__") return;
    dom["task-flow"].value = "";
    openNewFlow(dom["task-group"].value, true);
  }

  function syncTaskRecurrenceFields() {
    var cadence = dom["task-recurrence"].value;
    var recurring = automation.isCadence(cadence);
    dom["task-recurrence-start-field"].hidden = !recurring;
    dom["task-recurrence-end-field"].hidden = !recurring;
    dom["task-recurrence-start"].required = recurring;
    dom["task-recurrence-end"].required = recurring;
    if (recurring && !dom["task-recurrence-start"].value) {
      dom["task-recurrence-start"].value = dom["task-ddl"].value || dates.todayISO();
    }
    dom["task-status"].disabled = recurring;
    dom["task-recurrence-help"].textContent = i18n.isEnglish()
      ? recurring
        ? automation.cadenceLabel(cadence) +
          " recurrence shows multiple DDLs but counts as one Task. Completion applies only to the current natural " +
          (cadence === "weekly" ? "week." : "month.")
        : "A non-recurring Task appears once in the week containing its DDL."
      : recurring
        ? automation.cadenceLabel(cadence) +
          "显示多个 DDL，但只统计为一个 Task；完成勾选仅对应当前自然" +
          (cadence === "weekly" ? "周" : "月") +
          "。"
        : "不重复的 Task 只在其 DDL 所在周显示一次。";
    dom["task-status-help"].textContent = i18n.isEnglish()
      ? recurring
        ? "The Task status is maintained from the current natural " +
          (cadence === "weekly" ? "week's" : "month's") +
          " completion history. Mark it on the timeline."
        : "Set the overall completion status here for a non-recurring Task."
      : recurring
        ? "周期 Task 的状态由当前自然" +
          (cadence === "weekly" ? "周" : "月") +
          "完成记录自动维护，请在时间轴勾选。"
        : "非周期 Task 可在此设置整体完成状态。";
    syncCompletedDate();
  }

  function openNewTask() {
    if (ui.taskDraftConversion) resetTaskDraftConversionUi();
    if (!data.groups.length) {
      toast("请先新建一个分组，再创建 Task。", "warning");
      openNewGroup();
      return;
    }
    clearFieldErrors(dom["task-form"]);
    dom["task-dialog-title"].textContent = "新建 Task";
    dom["task-id"].value = "";
    dom["task-name"].value = "";
    var filteredFlow = getFlow(ui.filters.flowId);
    var initialGroupId = filteredFlow
      ? filteredFlow.groupId
      : ui.filters.groupIds.length === 1
        ? ui.filters.groupIds[0]
        : data.groups[0].id;
    populateTaskGroupSelect(initialGroupId);
    populateTaskFlowSelect(initialGroupId, filteredFlow ? filteredFlow.id : null);
    dom["task-ddl"].value = dates.todayISO();
    dom["task-recurrence"].value = "none";
    dom["task-recurrence-start"].value = "";
    dom["task-recurrence-end"].value = "";
    dom["task-urgency"].value = "";
    dom["task-status"].value = "pending";
    dom["task-completed-at"].value = "";
    syncTaskRecurrenceFields();
    dom["task-report-to"].value = "";
    dom["task-managed-object"].value = "";
    dom["task-deliverable"].value = "";
    dom["task-delete-button"].hidden = true;
    ui.taskDraftMaterials = [];
    renderDraftMaterials();
    dom["task-dialog"].showModal();
    setTimeout(function () {
      dom["task-name"].focus();
    }, 0);
  }

  function openEditTask(taskId) {
    if (ui.taskDraftConversion) resetTaskDraftConversionUi();
    var task = getTask(taskId);
    if (!task) return;
    clearFieldErrors(dom["task-form"]);
    dom["task-dialog-title"].textContent = "编辑 Task";
    dom["task-id"].value = task.id;
    dom["task-name"].value = task.name;
    populateTaskGroupSelect(task.groupId);
    populateTaskFlowSelect(task.groupId, task.flowId);
    dom["task-ddl"].value = task.ddl;
    dom["task-recurrence"].value = dates.recurrenceCadence(task);
    dom["task-recurrence-start"].value = task.recurrenceStart || "";
    dom["task-recurrence-end"].value = task.recurrenceEnd || "";
    dom["task-urgency"].value = task.urgency;
    dom["task-status"].value = task.status;
    dom["task-completed-at"].value = task.completedAt || "";
    syncTaskRecurrenceFields();
    dom["task-report-to"].value = task.reportTo;
    dom["task-managed-object"].value = task.managedObject;
    dom["task-deliverable"].value = task.deliverable;
    dom["task-delete-button"].hidden = false;
    ui.taskDraftMaterials = utils.clone(getTaskMaterials(task.id));
    renderDraftMaterials();
    dom["task-dialog"].showModal();
    setTimeout(function () {
      dom["task-name"].focus();
      dom["task-name"].select();
    }, 0);
  }

  function syncCompletedDate() {
    if (automation.isCadence(dom["task-recurrence"].value)) {
      dom["task-completed-at"].disabled = true;
      i18n.refreshDateInputs();
      return;
    }
    var completed = dom["task-status"].value === "completed";
    dom["task-completed-at"].disabled = !completed;
    if (completed && !dom["task-completed-at"].value) {
      dom["task-completed-at"].value = dates.todayISO();
    }
    if (!completed) dom["task-completed-at"].value = "";
    i18n.refreshDateInputs();
  }

  function addDraftMaterial() {
    ui.taskDraftMaterials.push(
      materialTools.makeMaterial({
        id: utils.uid("material"),
        title: "",
        url: "",
        type: "document"
      })
    );
    renderDraftMaterials();
    var inputs = queryAll('[data-material-field="title"]', dom["task-materials"]);
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  function renderDraftMaterials() {
    renderMaterialRows(dom["task-materials"], ui.taskDraftMaterials, {
      showOpen: false,
      onRemove: function (id) {
        ui.taskDraftMaterials = ui.taskDraftMaterials.filter(function (material) {
          return material.id !== id;
        });
        renderDraftMaterials();
      },
      onTypeChange: renderDraftMaterials
    });
  }

  function renderMaterialRows(container, materials, options) {
    utils.clear(container);
    if (!materials.length) {
      var empty = utils.el("p", "modal-context", "暂无相关资料");
      empty.style.margin = "4px 0";
      container.appendChild(empty);
      return;
    }
    materialTools.TYPES.forEach(function (type) {
      var typeMaterials = materials.filter(function (material) {
        return material.type === type;
      });
      if (!typeMaterials.length) return;
      var section = utils.el("section", "material-type-group type-" + type);
      var heading = utils.el("h4", "", materialTools.typeLabel(type));
      heading.appendChild(utils.el("span", "", typeMaterials.length));
      section.appendChild(heading);
      typeMaterials.forEach(function (material) {
        var row = utils.el("div", "link-row material-link-row");
        row.dataset.materialId = material.id;
        var title = utils.el("input");
        title.type = "text";
        title.maxLength = 160;
        title.placeholder = "链接名称";
        title.value = material.title;
        title.dataset.materialField = "title";
        title.setAttribute("aria-label", "链接名称");
        title.addEventListener("input", function () {
          material.title = title.value;
        });
        var url = utils.el("input");
        url.type = "url";
        url.maxLength = 3000;
        url.placeholder = "https://";
        url.value = material.url;
        url.dataset.materialField = "url";
        url.setAttribute("aria-label", "链接地址");
        url.addEventListener("input", function () {
          material.url = url.value;
        });
        var typeSelect = utils.el("select");
        typeSelect.dataset.materialField = "type";
        typeSelect.setAttribute("aria-label", "链接类型");
        materialTools.TYPES.forEach(function (value) {
          var option = utils.el("option", "", materialTools.typeLabel(value));
          option.value = value;
          typeSelect.appendChild(option);
        });
        typeSelect.value = material.type;
        typeSelect.addEventListener("change", function () {
          material.type = typeSelect.value;
          if (options && options.onTypeChange) options.onTypeChange();
        });
        row.append(title, url, typeSelect);
        if (options && options.showOpen) {
          var open = utils.el("button", "open-link", "打开");
          open.type = "button";
          open.addEventListener("click", function () {
            if (!utils.isValidUrl(url.value)) {
              url.classList.add("is-invalid");
              toast("请先输入合法的 HTTP/HTTPS 链接。", "error");
              return;
            }
            var saved = getMaterial(material.id);
            if (saved && saved.url === url.value.trim()) openMaterialLink(saved.id);
            else utils.safeOpen(url.value);
          });
          row.appendChild(open);
        }
        var remove = utils.el("button", "remove-link", "×");
        remove.type = "button";
        remove.title = "从当前 Task 移除资料关联";
        remove.setAttribute("aria-label", "移除资料 " + (material.title || ""));
        remove.addEventListener("click", function () {
          if (options && options.onRemove) options.onRemove(material.id);
        });
        row.appendChild(remove);
        section.appendChild(row);
      });
      container.appendChild(section);
    });
  }

  function collectMaterialRows(container, sourceMaterials) {
    var result = [];
    var valid = true;
    queryAll(".material-link-row", container).forEach(function (row) {
      var titleInput = query('[data-material-field="title"]', row);
      var urlInput = query('[data-material-field="url"]', row);
      var typeSelect = query('[data-material-field="type"]', row);
      titleInput.classList.remove("is-invalid");
      urlInput.classList.remove("is-invalid");
      var title = titleInput.value.trim();
      var url = urlInput.value.trim();
      if (!title) {
        titleInput.classList.add("is-invalid");
        valid = false;
      }
      if (!utils.isValidUrl(url)) {
        urlInput.classList.add("is-invalid");
        valid = false;
      }
      var original = sourceMaterials.find(function (material) {
        return material.id === row.dataset.materialId;
      });
      result.push(
        materialTools.normalizeMaterial(
          Object.assign({}, original || {}, {
            id: row.dataset.materialId || utils.uid("material"),
            title: title,
            url: url,
            type: typeSelect.value
          })
        )
      );
    });
    return { valid: valid, materials: result };
  }

  function reconcileTaskMaterials(taskId, selectedMaterials, stamp) {
    data.materials.forEach(function (material) {
      material.taskIds = material.taskIds.filter(function (id) {
        return id !== taskId;
      });
    });
    selectedMaterials.forEach(function (draft) {
      var material = getMaterial(draft.id);
      if (material) {
        material.title = draft.title;
        material.url = draft.url;
        material.type = draft.type;
        material.updatedAt = stamp;
      } else {
        material = materialTools.normalizeMaterial(
          Object.assign({}, draft, {
            id: draft.id || utils.uid("material"),
            createdAt: draft.createdAt || stamp,
            updatedAt: stamp
          })
        );
        data.materials.push(material);
      }
      material.taskIds = materialTools.uniqueIds(material.taskIds.concat(taskId));
    });
  }

  function saveTaskFromForm(event) {
    event.preventDefault();
    if (ui.isSavingTask) return;
    clearFieldErrors(dom["task-form"]);
    dom["task-links-error"].textContent = "";
    var id = dom["task-id"].value;
    var name = dom["task-name"].value.trim();
    var groupId = dom["task-group"].value;
    var flowId = dom["task-flow"].value || null;
    var selectedFlow = flowId ? getFlow(flowId) : null;
    var ddl = dates.formatDate(dom["task-ddl"].value);
    var urgency = dom["task-urgency"].value;
    var recurrenceCadence = dom["task-recurrence"].value;
    var recurrenceStart = dates.formatDate(dom["task-recurrence-start"].value);
    var recurrenceEnd = dates.formatDate(dom["task-recurrence-end"].value);
    var isRecurring = automation.isCadence(recurrenceCadence);
    var reportTo = dom["task-report-to"].value.trim();
    var deliverable = dom["task-deliverable"].value.trim();
    var isValid = true;
    if (!name) {
      setFieldError("task-name", "请输入 Task name。");
      isValid = false;
    }
    if (!getGroup(groupId)) {
      setFieldError("task-group", "请选择有效分组。");
      isValid = false;
    }
    if (flowId && (!selectedFlow || selectedFlow.groupId !== groupId)) {
      setFieldError("task-flow", "请选择当前分组下的有效 Flow。");
      isValid = false;
    }
    if (!ddl) {
      setFieldError("task-ddl", "请选择有效 DDL。");
      isValid = false;
    }
    if (recurrenceCadence !== "none" && !isRecurring) {
      setFieldError("task-recurrence", "请选择有效的周期。");
      isValid = false;
    }
    if (isRecurring) {
      if (!recurrenceStart) {
        setFieldError("task-recurrence-start", "请选择周期开始日期。");
        isValid = false;
      }
      if (!recurrenceEnd) {
        setFieldError("task-recurrence-end", "请选择周期结束日期。");
        isValid = false;
      }
      if (recurrenceStart && recurrenceEnd && recurrenceStart > recurrenceEnd) {
        setFieldError("task-recurrence-end", "周期结束日期不能早于开始日期。");
        isValid = false;
      }
      if (
        ddl &&
        recurrenceStart &&
        recurrenceEnd &&
        (ddl < recurrenceStart || ddl > recurrenceEnd)
      ) {
        setFieldError("task-ddl", "周期 Task 的 DDL 必须位于周期起止日期内。");
        isValid = false;
      }
      if (
        ddl &&
        recurrenceStart &&
        recurrenceEnd &&
        recurrenceStart <= recurrenceEnd &&
        !dates.getRecurringOccurrences({
          ddl: ddl,
          recurrenceCadence: recurrenceCadence,
          recurrenceStart: recurrenceStart,
          recurrenceEnd: recurrenceEnd
        }).length
      ) {
        setFieldError("task-ddl", "当前 DDL 与周期范围无法形成任何周期节点。");
        isValid = false;
      }
    }
    if (!["high", "medium", "low"].includes(urgency)) {
      setFieldError("task-urgency", "请选择紧急程度。");
      isValid = false;
    }
    if (!reportTo) {
      setFieldError("task-report-to", "请输入或选择汇报对象。");
      isValid = false;
    }
    if (!deliverable) {
      setFieldError("task-deliverable", "请输入交付物。");
      isValid = false;
    }
    var materialResult = collectMaterialRows(dom["task-materials"], ui.taskDraftMaterials);
    if (!materialResult.valid) {
      dom["task-links-error"].textContent =
        "每条资料都需要链接名称、类型和合法的 HTTP/HTTPS 地址。";
      isValid = false;
    }
    if (!isValid) {
      var firstInvalid = query(".is-invalid", dom["task-form"]);
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    ui.isSavingTask = true;
    dom["task-save-button"].disabled = true;
    var status =
      !isRecurring && dom["task-status"].value === "completed" ? "completed" : "pending";
    var stamp = new Date().toISOString();
    var existing = id ? getTask(id) : null;
    var flowOrder = null;
    if (flowId) {
      if (existing && existing.flowId === flowId && existing.flowOrder) {
        flowOrder = existing.flowOrder;
      } else {
        var existingOrders = data.tasks
          .filter(function (item) {
            return item.flowId === flowId && (!existing || item.id !== existing.id);
          })
          .map(function (item) {
            return Number(item.flowOrder || 0);
          });
        flowOrder = existingOrders.length ? Math.max.apply(null, existingOrders) + 1 : 1;
      }
    }
    var task = {
      id: existing ? existing.id : utils.uid("task"),
      groupId: groupId,
      flowId: flowId,
      flowOrder: flowOrder,
      name: name,
      reportTo: canonicalTaskSuggestionValue("reportTo", reportTo),
      managedObject: canonicalTaskSuggestionValue(
        "managedObject",
        dom["task-managed-object"].value
      ),
      deliverable: deliverable,
      ddl: ddl,
      urgency: urgency,
      status: status,
      completedAt:
        status === "completed" ? dom["task-completed-at"].value || dates.todayISO() : null,
      recurrenceCadence: isRecurring ? recurrenceCadence : "none",
      recurrenceStart: isRecurring ? recurrenceStart : null,
      recurrenceEnd: isRecurring ? recurrenceEnd : null,
      recurrenceCompletions: retainRecurringCompletions(existing, {
        ddl: ddl,
        recurrenceCadence: isRecurring ? recurrenceCadence : "none",
        recurrenceStart: isRecurring ? recurrenceStart : null,
        recurrenceEnd: isRecurring ? recurrenceEnd : null
      }),
      progressNote: existing ? existing.progressNote : "",
      progressUpdatedAt: existing ? existing.progressUpdatedAt : null,
      progressEntries: existing ? utils.clone(existing.progressEntries || []) : [],
      createdAt: existing ? existing.createdAt : stamp,
      updatedAt: stamp
    };
    if (existing) {
      var index = data.tasks.findIndex(function (item) {
        return item.id === existing.id;
      });
      data.tasks[index] = task;
    } else {
      data.tasks.push(task);
    }
    reconcileTaskMaterials(task.id, materialResult.materials, stamp);
    if (persistAndRender(existing ? "Task 已更新" : "Task 已创建")) {
      if (ui.taskDraftConversion) {
        var candidate = currentTaskDraftCandidate();
        if (candidate) {
          candidate.taskId = task.id;
          candidate.status = "saved";
          candidate.form = null;
          if (!ui.taskDraftConversion.createdTaskIds.includes(task.id)) {
            ui.taskDraftConversion.createdTaskIds.push(task.id);
          }
        }
        var nextIndex = nextPendingTaskDraftIndex();
        if (nextIndex >= 0) {
          loadTaskDraftCandidate(nextIndex);
        } else {
          renderTaskDraftConversionState();
          toast(
            i18n.isEnglish()
              ? "Every draft is resolved. Review them or select Complete Conversion."
              : "所有草稿均已处理，可复核后点击“完成转换”。"
          );
        }
      } else {
        dom["task-dialog"].close();
      }
    }
    ui.isSavingTask = false;
    dom["task-save-button"].disabled = false;
  }

  function retainRecurringCompletions(existing, schedule) {
    if (!existing || !dates.isRecurringTask(schedule)) return [];
    var occurrences = new Map(
      dates.getRecurringOccurrences(schedule).map(function (occurrence) {
        return [occurrence.periodKey, occurrence.ddl];
      })
    );
    return (Array.isArray(existing.recurrenceCompletions)
      ? existing.recurrenceCompletions
      : []
    )
      .filter(function (record) {
        return occurrences.has(record.periodKey);
      })
      .map(function (record) {
        return {
          periodKey: record.periodKey,
          occurrenceDdl: occurrences.get(record.periodKey),
          completedAt: dates.formatDate(record.completedAt) || occurrences.get(record.periodKey)
        };
      });
  }

  function requestDeleteCurrentTask() {
    var id = dom["task-id"].value;
    var task = getTask(id);
    if (!task) return;
    if (!confirmAction("确认删除 Task「" + task.name + "」？此操作不可恢复。")) return;
    data.tasks = data.tasks.filter(function (item) {
      return item.id !== id;
    });
    data.materials.forEach(function (material) {
      material.taskIds = material.taskIds.filter(function (taskId) {
        return taskId !== id;
      });
    });
    dom["task-dialog"].close();
    persistAndRender("Task 已删除");
  }

  function openProgressManager(taskId) {
    var task = getTask(taskId);
    if (!task) return;
    ui.managedProgressTaskId = taskId;
    ui.managedProgressEntryId = null;
    ui.progressDraftEntry = null;
    ui.progressDirty = false;
    dom["progress-dialog-task"].textContent =
      task.name +
      (i18n.isEnglish()
        ? " · Each update is stored as an independent timestamped record"
        : " · 每次更新都保存为一条独立的时间戳记录");
    var latest = richText.latestProgressEntry(task);
    if (latest) loadProgressEntry(latest.id);
    else prepareNewProgressEntry();
    dom["progress-dialog"].showModal();
    setTimeout(function () {
      dom["progress-note"].focus();
    }, 0);
  }

  function formatProgressTimestamp(value) {
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return i18n.isEnglish() ? "Unknown time" : "未知时间";
    return parsed.toLocaleString(i18n.locale(), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function updateProgressCharacterCount() {
    var length = richText.plainText(dom["progress-note"].innerHTML).length;
    dom["progress-character-count"].textContent =
      length + " / " + richText.MAX_PROGRESS_TEXT;
    dom["progress-character-count"].style.color =
      length > richText.MAX_PROGRESS_TEXT ? "var(--coral)" : "";
  }

  function progressEntrySourceLabel(entry) {
    if (!entry) return "";
    if (entry.sourceType === "quick-note") {
      var note = getNote(entry.sourceNoteId);
      return i18n.isEnglish()
        ? "From Quick Notes" + (note ? ": " + note.title : "")
        : "来自随手记" + (note ? "：“" + note.title + "”" : "");
    }
    if (entry.sourceType === "excel-import") return i18n.isEnglish() ? "Imported from Excel" : "从 Excel 导入";
    if (entry.sourceType === "legacy") return i18n.isEnglish() ? "Migrated from an earlier version" : "由旧版进度迁移";
    return i18n.isEnglish() ? "Manual record" : "手动记录";
  }

  function renderProgressEntryList() {
    var task = getTask(ui.managedProgressTaskId);
    var container = utils.clear(dom["progress-entry-list"]);
    if (!task) return;
    var entries = richText.sortProgressEntries(task.progressEntries || []);
    if (ui.progressDraftEntry && !ui.managedProgressEntryId) {
      var draftButton = utils.el("button", "progress-entry-item is-active");
      draftButton.type = "button";
      draftButton.append(
        utils.el("strong", "", i18n.isEnglish() ? "New record" : "新记录"),
        utils.el("small", "", i18n.isEnglish() ? "Not saved" : "尚未保存")
      );
      container.appendChild(draftButton);
    }
    entries.forEach(function (entry) {
      var button = utils.el(
        "button",
        "progress-entry-item" + (entry.id === ui.managedProgressEntryId ? " is-active" : "")
      );
      button.type = "button";
      button.dataset.action = "select-progress-entry";
      button.dataset.progressEntryId = entry.id;
      button.dataset.userContent = "";
      button.append(
        utils.el("strong", "", entry.contentText.replace(/\s+/g, " ").slice(0, 54)),
        utils.el("small", "", formatProgressTimestamp(entry.updatedAt || entry.createdAt))
      );
      container.appendChild(button);
    });
    if (!entries.length && !ui.progressDraftEntry) {
      container.appendChild(
        utils.el(
          "p",
          "progress-entry-list-empty",
          i18n.isEnglish()
            ? "No progress history yet. Select New Record to begin."
            : "暂无进度历史，点击“新建记录”开始。"
        )
      );
    }
  }

  function showProgressDraft(entry, existingId) {
    ui.managedProgressEntryId = existingId || null;
    ui.progressDraftEntry = utils.clone(entry);
    ui.progressDirty = false;
    dom["progress-note"].innerHTML = entry.contentHtml || "";
    dom["progress-dialog-updated"].textContent = existingId
      ? (i18n.isEnglish() ? "Created: " : "创建：") +
        formatProgressTimestamp(entry.createdAt) +
        " · " +
        (i18n.isEnglish() ? "Last updated: " : "最后编辑：") +
        formatProgressTimestamp(entry.updatedAt) +
        " · " +
        progressEntrySourceLabel(entry)
      : i18n.isEnglish()
        ? "New record · not saved"
        : "新记录 · 尚未保存";
    dom["progress-delete-button"].hidden = !existingId;
    updateProgressCharacterCount();
    renderProgressEntryList();
  }

  function loadProgressEntry(entryId) {
    var task = getTask(ui.managedProgressTaskId);
    var entry = task && (task.progressEntries || []).find(function (item) { return item.id === entryId; });
    if (!entry) return;
    showProgressDraft(entry, entry.id);
  }

  function prepareNewProgressEntry() {
    var stamp = new Date().toISOString();
    showProgressDraft(
      {
        id: utils.uid("progress"),
        contentHtml: "",
        contentText: "",
        sourceType: "manual",
        sourceNoteId: null,
        createdAt: stamp,
        updatedAt: stamp
      },
      null
    );
  }

  function confirmDiscardProgressChanges() {
    return (
      !ui.progressDirty ||
      confirmAction("当前进度记录尚未保存，继续后修改会丢失。仍要继续吗？")
    );
  }

  function selectProgressEntry(entryId) {
    if (entryId === ui.managedProgressEntryId) return;
    if (!confirmDiscardProgressChanges()) return;
    loadProgressEntry(entryId);
  }

  function newProgressEntry() {
    if (!confirmDiscardProgressChanges()) return;
    prepareNewProgressEntry();
    setTimeout(function () { dom["progress-note"].focus(); }, 0);
  }

  function saveProgressEntry(event) {
    event.preventDefault();
    var task = getTask(ui.managedProgressTaskId);
    if (!task) {
      toast("Task 不存在，无法保存进度记录。", "error");
      return;
    }
    dom["progress-save-button"].disabled = true;
    var contentHtml = richText.sanitizeHtml(
      dom["progress-note"].innerHTML,
      richText.MAX_PROGRESS_TEXT
    );
    var contentText = richText.plainText(contentHtml);
    if (!contentText) {
      toast(i18n.isEnglish() ? "Enter progress content." : "请输入进度内容。", "error");
      dom["progress-save-button"].disabled = false;
      return;
    }
    if (contentText.length > richText.MAX_PROGRESS_TEXT) {
      toast(i18n.isEnglish() ? "The progress record is too long." : "进度记录内容过长。", "error");
      dom["progress-save-button"].disabled = false;
      return;
    }
    var stamp = new Date().toISOString();
    var existing = ui.managedProgressEntryId
      ? (task.progressEntries || []).find(function (entry) {
          return entry.id === ui.managedProgressEntryId;
        })
      : null;
    var entry = storage.normalizeProgressEntry({
      id: existing ? existing.id : ui.progressDraftEntry.id,
      contentHtml: contentHtml,
      contentText: contentText,
      sourceType: existing ? existing.sourceType : "manual",
      sourceNoteId: existing ? existing.sourceNoteId : null,
      createdAt: existing ? existing.createdAt : stamp,
      updatedAt: stamp
    });
    if (existing) {
      task.progressEntries[task.progressEntries.indexOf(existing)] = entry;
    } else {
      task.progressEntries = (task.progressEntries || []).concat(entry);
    }
    updateTaskProgressAliases(task);
    task.updatedAt = stamp;
    ui.progressDirty = false;
    var saved = ui.view === "timeline"
      ? persistAndRenderTimelineAction("task", task.id, "进度记录已保存")
      : persistAndRender("进度记录已保存");
    if (saved) {
      dom["progress-dialog"].close();
    }
    dom["progress-save-button"].disabled = false;
  }

  function deleteProgressEntry() {
    var task = getTask(ui.managedProgressTaskId);
    var entry = task && (task.progressEntries || []).find(function (item) {
      return item.id === ui.managedProgressEntryId;
    });
    if (!entry) return;
    if (!confirmAction("确认删除当前这条进度记录？")) return;
    if (!confirmAction("请再次确认。删除后无法恢复。")) return;
    task.progressEntries = task.progressEntries.filter(function (item) { return item.id !== entry.id; });
    updateTaskProgressAliases(task);
    task.updatedAt = new Date().toISOString();
    ui.progressDirty = false;
    var saved = ui.view === "timeline"
      ? persistAndRenderTimelineAction("task", task.id, "进度记录已删除")
      : persistAndRender("进度记录已删除");
    if (!saved) return;
    var latest = richText.latestProgressEntry(getTask(task.id));
    if (latest) loadProgressEntry(latest.id);
    else prepareNewProgressEntry();
  }

  function requestCloseProgressDialog() {
    if (!confirmDiscardProgressChanges()) return;
    ui.progressDirty = false;
    dom["progress-dialog"].close();
  }

  function handleProgressDialogCancel(event) {
    event.preventDefault();
    requestCloseProgressDialog();
  }

  function openLinkManager(taskId) {
    var task = getTask(taskId);
    if (!task) return;
    ui.managedTaskId = taskId;
    ui.managedMaterials = utils.clone(getTaskMaterials(taskId));
    dom["link-dialog-title"].textContent = i18n.isEnglish()
      ? "Manage Related Documents"
      : "管理相关资料";
    dom["link-dialog-task"].textContent =
      task.name +
      (i18n.isEnglish()
        ? " · Documents are grouped by type; changes sync to the Document Library"
        : " · 资料按类型分组；修改后会同步到资料库");
    dom["link-manager-error"].textContent = "";
    renderManagedLinks();
    dom["link-dialog"].showModal();
  }

  function renderManagedLinks() {
    renderMaterialRows(dom["link-manager-rows"], ui.managedMaterials, {
      showOpen: true,
      onRemove: function (id) {
        ui.managedMaterials = ui.managedMaterials.filter(function (material) {
          return material.id !== id;
        });
        renderManagedLinks();
      },
      onTypeChange: renderManagedLinks
    });
  }

  function addManagedLink() {
    ui.managedMaterials.push(
      materialTools.makeMaterial({
        id: utils.uid("material"),
        title: "",
        url: "",
        type: "document"
      })
    );
    renderManagedLinks();
    var inputs = queryAll('[data-material-field="title"]', dom["link-manager-rows"]);
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  function saveManagedLinks(event) {
    event.preventDefault();
    dom["link-manager-error"].textContent = "";
    var result = collectMaterialRows(dom["link-manager-rows"], ui.managedMaterials);
    if (!result.valid) {
      dom["link-manager-error"].textContent =
        "每条资料都需要链接名称、类型和合法的 HTTP/HTTPS 地址。";
      return;
    }
    var task = getTask(ui.managedTaskId);
    if (!task) {
      toast("Task 不存在，无法保存资料。", "error");
      return;
    }
    var stamp = new Date().toISOString();
    reconcileTaskMaterials(task.id, result.materials, stamp);
    task.updatedAt = stamp;
    if (persistAndRender("相关资料已保存并同步到资料库")) dom["link-dialog"].close();
  }

  function relationOptionLabel(kind, item) {
    if (kind === "group") return item.name;
    if (kind === "flow") {
      var flowGroup = getGroup(item.groupId);
      return [flowGroup && flowGroup.name, item.name].filter(Boolean).join(" / ");
    }
    var taskGroup = getGroup(item.groupId);
    var taskFlow = getFlow(item.flowId);
    return [taskGroup && taskGroup.name, taskFlow && taskFlow.name, item.name]
      .filter(Boolean)
      .join(" / ");
  }

  function renderRelationOptions(container, kind, items, selectedIds, emptyMessage) {
    utils.clear(container);
    if (!items.length) {
      container.appendChild(
        utils.el("p", "relation-empty", emptyMessage || "暂无可选内容")
      );
      return;
    }
    items.forEach(function (item) {
      var label = utils.el("label", "relation-option");
      label.dataset.relationLabel = utils.normalizeText(relationOptionLabel(kind, item));
      var checkbox = utils.el("input");
      checkbox.type = "checkbox";
      checkbox.value = item.id;
      checkbox.dataset.relationType = kind;
      checkbox.checked = selectedIds.includes(item.id);
      label.append(checkbox, utils.el("span", "", relationOptionLabel(kind, item)));
      container.appendChild(label);
    });
  }

  function setMaterialRelationStepState(kind, enabled) {
    var search = query('[data-relation-search="' + kind + '"]', dom["material-form"]);
    var fieldset = search ? search.closest(".relation-fieldset") : null;
    if (search) {
      search.disabled = !enabled;
      search.placeholder = enabled ? "搜索 " + (kind === "flow" ? "Flow" : "Task") : "请先选择分组";
    }
    if (fieldset) fieldset.classList.toggle("is-locked", !enabled);
  }

  function renderMaterialRelationOptions(selection) {
    var relations = selection || { taskIds: [], flowIds: [], groupIds: [] };
    var selectedGroupIds = materialTools.uniqueIds(relations.groupIds).filter(function (id) {
      return Boolean(getGroup(id));
    });
    var selectedFlowIds = materialTools.uniqueIds(relations.flowIds);
    var selectedTaskIds = materialTools.uniqueIds(relations.taskIds);
    var hasSelectedGroups = selectedGroupIds.length > 0;

    renderRelationOptions(
      dom["material-group-options"],
      "group",
      getSortedGroups(),
      selectedGroupIds,
      "还没有可选分组"
    );

    var availableFlows = hasSelectedGroups
      ? getSortedFlows().filter(function (flow) {
          return selectedGroupIds.includes(flow.groupId);
        })
      : [];
    renderRelationOptions(
      dom["material-flow-options"],
      "flow",
      availableFlows,
      selectedFlowIds.filter(function (id) {
        return availableFlows.some(function (flow) {
          return flow.id === id;
        });
      }),
      hasSelectedGroups ? "所选分组暂无 Flow" : "请先选择分组"
    );

    var availableTasks = hasSelectedGroups
      ? data.tasks
          .filter(function (task) {
            return selectedGroupIds.includes(task.groupId);
          })
          .sort(function (left, right) {
            return relationOptionLabel("task", left).localeCompare(
              relationOptionLabel("task", right),
              "zh-CN",
              { numeric: true }
            );
          })
      : [];
    renderRelationOptions(
      dom["material-task-options"],
      "task",
      availableTasks,
      selectedTaskIds.filter(function (id) {
        return availableTasks.some(function (task) {
          return task.id === id;
        });
      }),
      hasSelectedGroups ? "所选分组暂无 Task" : "请先选择分组"
    );

    setMaterialRelationStepState("flow", hasSelectedGroups);
    setMaterialRelationStepState("task", hasSelectedGroups);
    queryAll("[data-relation-search]", dom["material-form"]).forEach(function (input) {
      input.value = "";
    });
  }

  function openMaterialDialog(materialId) {
    var material = materialId ? getMaterial(materialId) : null;
    clearFieldErrors(dom["material-form"]);
    ui.editingMaterialId = material ? material.id : null;
    dom["material-dialog-title"].textContent = i18n.isEnglish()
      ? material ? "Edit Document" : "Add Document"
      : material ? "编辑资料" : "添加资料";
    dom["material-id"].value = material ? material.id : "";
    dom["material-title"].value = material ? material.title : "";
    dom["material-url"].value = material ? material.url : "";
    dom["material-type"].value = material ? material.type : "document";
    dom["material-note"].value = material ? material.note : "";
    dom["material-delete-button"].hidden = !material;
    renderMaterialRelationOptions(
      material
        ? materialTools.resolveRelations(material, data)
        : { taskIds: [], flowIds: [], groupIds: [] }
    );
    dom["material-dialog"].showModal();
    setTimeout(function () {
      dom["material-title"].focus();
      if (material) dom["material-title"].select();
    }, 0);
  }

  function handleMaterialRelationSearch(event) {
    var kind = event.target.dataset.relationSearch;
    if (!kind) return;
    var container =
      kind === "task"
        ? dom["material-task-options"]
        : kind === "flow"
          ? dom["material-flow-options"]
          : dom["material-group-options"];
    var needle = utils.normalizeText(event.target.value);
    queryAll("[data-relation-label]", container).forEach(function (label) {
      label.hidden = Boolean(needle && !label.dataset.relationLabel.includes(needle));
    });
  }

  function handleMaterialRelationChange(event) {
    var kind = event.target.dataset.relationType;
    if (kind !== "group") return;
    renderMaterialRelationOptions({
      groupIds: selectedRelationIds("group"),
      flowIds: selectedRelationIds("flow"),
      taskIds: selectedRelationIds("task")
    });
  }

  function selectedRelationIds(kind) {
    return queryAll('[data-relation-type="' + kind + '"]:checked', dom["material-form"]).map(
      function (input) {
        return input.value;
      }
    );
  }

  function compactMaterialRelations(taskIds, flowIds, groupIds) {
    var taskFlowIds = new Set();
    var derivedGroupIds = new Set();
    taskIds.forEach(function (taskId) {
      var task = getTask(taskId);
      if (!task) return;
      derivedGroupIds.add(task.groupId);
      if (task.flowId) taskFlowIds.add(task.flowId);
    });
    var explicitFlowIds = flowIds.filter(function (flowId) {
      return !taskFlowIds.has(flowId);
    });
    Array.from(taskFlowIds)
      .concat(explicitFlowIds)
      .forEach(function (flowId) {
        var flow = getFlow(flowId);
        if (flow) derivedGroupIds.add(flow.groupId);
      });
    return {
      taskIds: materialTools.uniqueIds(taskIds),
      flowIds: materialTools.uniqueIds(explicitFlowIds),
      groupIds: materialTools.uniqueIds(
        groupIds.filter(function (groupId) {
          return !derivedGroupIds.has(groupId);
        })
      )
    };
  }

  function saveMaterialFromForm(event) {
    event.preventDefault();
    clearFieldErrors(dom["material-form"]);
    var title = dom["material-title"].value.trim();
    var url = dom["material-url"].value.trim();
    var valid = true;
    if (!title) {
      setFieldError("material-title", "请输入链接名称。");
      valid = false;
    }
    if (!utils.isValidUrl(url)) {
      setFieldError("material-url", "请输入合法的 HTTP/HTTPS 链接地址。");
      valid = false;
    }
    if (!valid) {
      var firstInvalid = query(".is-invalid", dom["material-form"]);
      if (firstInvalid) firstInvalid.focus();
      return;
    }
    dom["material-save-button"].disabled = true;
    var stamp = new Date().toISOString();
    var existing = getMaterial(dom["material-id"].value);
    var compactRelations = compactMaterialRelations(
      selectedRelationIds("task"),
      selectedRelationIds("flow"),
      selectedRelationIds("group")
    );
    var material = materialTools.normalizeMaterial({
      id: existing ? existing.id : utils.uid("material"),
      title: title,
      url: url,
      type: dom["material-type"].value,
      taskIds: compactRelations.taskIds,
      flowIds: compactRelations.flowIds,
      groupIds: compactRelations.groupIds,
      note: dom["material-note"].value,
      openEvents: existing ? existing.openEvents : [],
      createdAt: existing ? existing.createdAt : stamp,
      updatedAt: stamp
    });
    if (existing) {
      data.materials[data.materials.indexOf(existing)] = material;
    } else {
      data.materials.push(material);
    }
    if (persistAndRender(existing ? "资料已更新并同步到时间轴" : "资料已添加")) {
      dom["material-dialog"].close();
    }
    dom["material-save-button"].disabled = false;
  }

  function deleteCurrentMaterial() {
    var material = getMaterial(dom["material-id"].value);
    if (!material) return;
    if (!confirmAction("确认删除资料「" + material.title + "」？所有 Task 中的关联也会移除。")) {
      return;
    }
    data.materials = data.materials.filter(function (item) {
      return item.id !== material.id;
    });
    dom["material-dialog"].close();
    persistAndRender("资料已删除");
  }

  function normalizedPathParts(value) {
    return String(value || "")
      .split("/")
      .map(function (part) {
        return utils.normalizeText(part);
      })
      .filter(Boolean);
  }

  function resolveGroupToken(token) {
    var parts = normalizedPathParts(token);
    var name = parts[parts.length - 1] || "";
    return data.groups.filter(function (group) {
      return utils.normalizeText(group.name) === name;
    });
  }

  function resolveFlowToken(token) {
    var parts = normalizedPathParts(token);
    var flowName = parts[parts.length - 1] || "";
    var groupName = parts.length > 1 ? parts[parts.length - 2] : "";
    return data.flows.filter(function (flow) {
      var group = getGroup(flow.groupId);
      return (
        utils.normalizeText(flow.name) === flowName &&
        (!groupName || (group && utils.normalizeText(group.name) === groupName))
      );
    });
  }

  function resolveTaskToken(token) {
    var parts = normalizedPathParts(token);
    var taskName = parts[parts.length - 1] || "";
    var qualifierA = parts.length > 1 ? parts[parts.length - 2] : "";
    var qualifierB = parts.length > 2 ? parts[parts.length - 3] : "";
    return data.tasks.filter(function (task) {
      if (utils.normalizeText(task.name) !== taskName) return false;
      var group = getGroup(task.groupId);
      var flow = getFlow(task.flowId);
      if (parts.length >= 3) {
        return (
          group &&
          flow &&
          utils.normalizeText(group.name) === qualifierB &&
          utils.normalizeText(flow.name) === qualifierA
        );
      }
      if (parts.length === 2) {
        return Boolean(
          (group && utils.normalizeText(group.name) === qualifierA) ||
            (flow && utils.normalizeText(flow.name) === qualifierA)
        );
      }
      return true;
    });
  }

  function resolveMaterialImportRow(row) {
    var errors = [];
    function resolveTokens(tokens, resolver, label) {
      var ids = [];
      tokens.forEach(function (token) {
        var matches = resolver(token);
        if (!matches.length) {
          errors.push(label + "「" + token + "」不存在");
        } else if (matches.length > 1) {
          errors.push(label + "「" + token + "」存在重名，请使用完整层级路径");
        } else if (!ids.includes(matches[0].id)) {
          ids.push(matches[0].id);
        }
      });
      return ids;
    }
    var taskIds = resolveTokens(row.taskNames, resolveTaskToken, "Task");
    var flowIds = resolveTokens(row.flowNames, resolveFlowToken, "Flow");
    var groupIds = resolveTokens(row.groupNames, resolveGroupToken, "分组");
    var compactRelations = compactMaterialRelations(taskIds, flowIds, groupIds);
    return {
      sourceRow: row.sourceRow,
      errors: errors,
      value: {
        title: row.title,
        url: row.url,
        type: row.type,
        taskIds: compactRelations.taskIds,
        flowIds: compactRelations.flowIds,
        groupIds: compactRelations.groupIds,
        note: row.note
      }
    };
  }

  function materialUrlKey(value) {
    try {
      var parsed = new URL(value);
      return (
        parsed.protocol.toLocaleLowerCase() +
        "//" +
        parsed.host.toLocaleLowerCase() +
        parsed.pathname +
        parsed.search +
        parsed.hash
      );
    } catch (_error) {
      return String(value || "").trim();
    }
  }

  function renderMaterialImportMode() {
    var modeInput = query('input[name="material-import-mode"]:checked');
    var mode = modeInput ? modeInput.value : "append";
    var duplicateCount = ui.pendingMaterialImport
      ? ui.pendingMaterialImport.duplicateCount
      : 0;
    dom["material-duplicate-choice"].hidden = mode !== "append" || duplicateCount === 0;
  }

  function renderMaterialImportDialog(file, result) {
    var resolved = result.rows.map(resolveMaterialImportRow);
    var errors = result.errors.map(function (message) {
      return i18n.translateMessage(message);
    });
    var seenUploadUrls = new Map();
    resolved.forEach(function (row) {
      row.errors.forEach(function (message) {
        errors.push(
          i18n.isEnglish()
            ? "Row " + row.sourceRow + ": " + i18n.translateMessage(message)
            : "第 " + row.sourceRow + " 行：" + message
        );
      });
      var key = materialUrlKey(row.value.url);
      if (seenUploadUrls.has(key)) {
        errors.push(i18n.isEnglish()
          ? "Row " + row.sourceRow + ": Link URL duplicates row " + seenUploadUrls.get(key)
          : "第 " + row.sourceRow + " 行：链接地址与第 " + seenUploadUrls.get(key) + " 行重复");
      } else {
        seenUploadUrls.set(key, row.sourceRow);
      }
    });
    if (!resolved.length && !errors.length) {
      errors.push("文件中没有可导入的资料。");
    }
    var existingByUrl = new Map();
    data.materials.forEach(function (material) {
      var key = materialUrlKey(material.url);
      if (!existingByUrl.has(key)) existingByUrl.set(key, material);
    });
    var rows = resolved.map(function (row) {
      var existing = existingByUrl.get(materialUrlKey(row.value.url));
      return Object.assign({}, row.value, {
        duplicateId: existing ? existing.id : null
      });
    });
    var duplicateCount = rows.filter(function (row) {
      return row.duplicateId;
    }).length;
    ui.pendingMaterialImport = {
      rows: rows,
      errors: errors,
      duplicateCount: duplicateCount
    };
    dom["material-import-file"].textContent =
      file.name + (result.sheetName ? " · 工作表：" + result.sheetName : "");
    var summary = utils.clear(dom["material-import-summary"]);
    [
      [resolved.length, " 条资料"],
      [
        resolved.filter(function (row) {
          return row.value.taskIds.length;
        }).length,
        " 条关联 Task"
      ],
      [
        resolved.filter(function (row) {
          return (
            !row.value.taskIds.length &&
            !row.value.flowIds.length &&
            !row.value.groupIds.length
          );
        }).length,
        " 条未分组"
      ],
      [
        duplicateCount,
        " 条地址重复"
      ]
    ].forEach(function (item) {
      var card = utils.el("span");
      card.append(utils.el("b", "", item[0]), document.createTextNode(item[1]));
      summary.appendChild(card);
    });
    var errorBox = utils.clear(dom["material-import-errors"]);
    errorBox.classList.toggle("has-errors", errors.length > 0);
    if (errors.length) {
      errorBox.appendChild(
        utils.el("strong", "", "发现 " + errors.length + " 个问题，修正后请重新选择文件：")
      );
      var list = utils.el("ul");
      errors.slice(0, 50).forEach(function (message) {
        list.appendChild(utils.el("li", "", i18n.translateMessage(message)));
      });
      errorBox.appendChild(list);
    }
    var preview = utils.clear(dom["material-import-preview"]);
    resolved.slice(0, 20).forEach(function (row, index) {
      var tableRow = utils.el("tr");
      [
        index + 1,
        row.value.title,
        materialTools.typeLabel(row.value.type),
        row.value.taskIds
          .map(function (id) {
            return getTask(id).name;
          })
          .join("、") || "—",
        materialTools
          .resolveRelations(row.value, data)
          .groups.map(function (group) {
            return group.name;
          })
          .join("、") || "未分组"
      ].forEach(function (value) {
        tableRow.appendChild(utils.el("td", "", value));
      });
      preview.appendChild(tableRow);
    });
    dom["material-import-confirm"].disabled = Boolean(errors.length || !resolved.length);
    dom["material-import-confirm"].textContent = "确认导入";
    var appendMode = query('input[name="material-import-mode"][value="append"]');
    var duplicateReplace = query('input[name="material-duplicate-mode"][value="replace"]');
    if (appendMode) appendMode.checked = true;
    if (duplicateReplace) duplicateReplace.checked = true;
    renderMaterialImportMode();
    if (!dom["material-import-dialog"].open) dom["material-import-dialog"].showModal();
  }

  function openMaterialFilePicker() {
    closeDetailsMenus();
    dom["material-file-input"].value = "";
    dom["material-file-input"].click();
  }

  function importMaterialFile(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast("Excel 文件不能超过 15 MB。", "error");
      return;
    }
    var reader = new FileReader();
    reader.onerror = function () {
      toast("无法读取所选 Excel 文件。", "error");
    };
    reader.onload = function () {
      renderMaterialImportDialog(file, materialExcel.parseWorkbook(reader.result));
    };
    reader.readAsArrayBuffer(file);
  }

  function closeMaterialImportDialog() {
    ui.pendingMaterialImport = null;
    if (dom["material-import-dialog"].open) dom["material-import-dialog"].close();
  }

  function confirmMaterialImport() {
    var pending = ui.pendingMaterialImport;
    if (
      ui.isImportingMaterials ||
      !pending ||
      !pending.rows.length ||
      pending.errors.length
    ) {
      return;
    }
    var modeInput = query('input[name="material-import-mode"]:checked');
    var mode = modeInput ? modeInput.value : "append";
    var duplicateInput = query('input[name="material-duplicate-mode"]:checked');
    var duplicateMode = duplicateInput ? duplicateInput.value : "replace";
    if (mode === "replace") {
      if (
        !confirmAction(
          "全部覆盖会先删除资料库现有的 " +
            data.materials.length +
            " 条资料，再导入 " +
            pending.rows.length +
            " 条新资料。是否继续？"
        )
      ) {
        return;
      }
      if (!confirmAction("再次确认：全部覆盖不可撤销，建议已先导出 JSON 备份。")) return;
    }
    ui.isImportingMaterials = true;
    dom["material-import-confirm"].disabled = true;
    var stamp = new Date().toISOString();
    var backup = utils.clone(data.materials);
    var importedCount = 0;
    var replacedCount = 0;
    var skippedCount = 0;
    if (mode === "replace") {
      data.materials = [];
      ui.selectedMaterialIds = [];
    }
    pending.rows.forEach(function (row) {
      var duplicate = mode === "append" && row.duplicateId
        ? getMaterial(row.duplicateId)
        : null;
      if (duplicate && duplicateMode === "skip") {
        skippedCount += 1;
        return;
      }
      var details = Object.assign({}, row);
      delete details.duplicateId;
      if (duplicate) {
        var replacement = materialTools.makeMaterial(
          Object.assign({}, details, {
            id: duplicate.id,
            openEvents: duplicate.openEvents,
            createdAt: duplicate.createdAt,
            updatedAt: stamp
          }),
          stamp
        );
        data.materials[data.materials.indexOf(duplicate)] = replacement;
        replacedCount += 1;
      } else {
        data.materials.push(
          materialTools.makeMaterial(
            Object.assign({}, details, {
              id: utils.uid("material"),
              createdAt: stamp,
              updatedAt: stamp
            }),
            stamp
          )
        );
        importedCount += 1;
      }
    });
    var message =
      mode === "replace"
        ? "已全部覆盖资料库，共导入 " + importedCount + " 条资料"
        : "资料导入完成：新增 " +
          importedCount +
          " 条，替换 " +
          replacedCount +
          " 条，跳过 " +
          skippedCount +
          " 条";
    if (persistAndRender(message)) {
      closeMaterialImportDialog();
      switchView("materials");
    } else {
      data.materials = backup;
      renderAll();
    }
    ui.isImportingMaterials = false;
    dom["material-import-confirm"].disabled = false;
  }

  function exportMaterialLibrary() {
    closeDetailsMenus();
    if (!materialExcel || typeof materialExcel.exportWorkbook !== "function") {
      toast("资料库 Excel 组件未加载，请刷新页面后重试。", "error", 6500);
      return;
    }
    var filename =
      (i18n.isEnglish() ? "Weekflow_Document_Library_" : "Weekflow_资料库_") +
      dates.dateTimeStamp(new Date()) +
      ".xlsx";
    materialExcel
      .exportWorkbook(data, window.JSZip, filename)
      .then(function (result) {
        utils.downloadBlob(result.blob, result.filename);
        toast("资料库已下载：" + result.filename);
      })
      .catch(function (error) {
        toast("资料库下载失败：" + error.message, "error", 7000);
      });
  }

  function normalizeImportName(value) {
    return utils.normalizeText(value);
  }

  function importFlowKey(groupName, flowName) {
    return normalizeImportName(groupName) + "::" + normalizeImportName(flowName);
  }

  function analyzeExcelRows(rows) {
    var existingGroups = new Set(
      data.groups.map(function (group) {
        return normalizeImportName(group.name);
      })
    );
    var existingFlows = new Set(
      data.flows.map(function (flow) {
        var group = getGroup(flow.groupId);
        return importFlowKey(group ? group.name : "", flow.name);
      })
    );
    var fileGroups = new Set();
    var fileFlows = new Set();
    rows.forEach(function (row) {
      fileGroups.add(normalizeImportName(row.groupName));
      if (row.flowName) fileFlows.add(importFlowKey(row.groupName, row.flowName));
    });
    var newGroupCount = Array.from(fileGroups).filter(function (key) {
      return !existingGroups.has(key);
    }).length;
    var newFlowCount = Array.from(fileFlows).filter(function (key) {
      return !existingFlows.has(key);
    }).length;
    return {
      taskCount: rows.length,
      groupCount: fileGroups.size,
      flowCount: fileFlows.size,
      newGroupCount: newGroupCount,
      newFlowCount: newFlowCount
    };
  }

  function appendImportSummaryCard(value, label) {
    var card = utils.el("span");
    card.append(utils.el("b", "", value), document.createTextNode(label));
    dom["excel-import-summary"].appendChild(card);
  }

  function renderExcelImportMode() {
    var pending = ui.pendingExcelImport;
    if (!pending) return;
    var modeInput = query('input[name="excel-import-mode"]:checked');
    var mode = modeInput ? modeInput.value : "append";
    var summary = pending.summary;
    utils.clear(dom["excel-import-summary"]);
    appendImportSummaryCard(summary.taskCount, " 条 Task");
    appendImportSummaryCard(
      mode === "replace" ? summary.groupCount : summary.newGroupCount,
      mode === "replace" ? " 个分组" : " 个新分组"
    );
    appendImportSummaryCard(
      mode === "replace" ? summary.flowCount : summary.newFlowCount,
      mode === "replace" ? " 个 Flow" : " 个新 Flow"
    );
    if (!ui.isImportingExcel) {
      dom["excel-import-confirm"].textContent =
        mode === "replace" ? "确认完整覆盖" : "确认补充导入";
    }
  }

  function renderExcelImportDialog(file, result) {
    var errors = result.errors.map(function (message) {
      return i18n.translateMessage(message);
    });
    if (!result.rows.length && !errors.length) {
      errors.push("文件中没有可导入的 Task，请在模板表头下方填写数据。");
    }
    var summary = analyzeExcelRows(result.rows);
    ui.pendingExcelImport = {
      filename: file.name,
      rows: utils.clone(result.rows),
      errors: errors,
      summary: summary
    };

    var sizeLabel =
      file.size >= 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(1) + " MB"
        : Math.max(1, Math.round(file.size / 1024)) + " KB";
    dom["excel-import-file"].textContent =
      file.name + " · " + sizeLabel + (result.sheetName ? " · 工作表：" + result.sheetName : "");

    var errorBox = utils.clear(dom["excel-import-errors"]);
    errorBox.classList.toggle("has-errors", errors.length > 0);
    if (errors.length) {
      errorBox.appendChild(
        utils.el(
          "strong",
          "",
          "发现 " + errors.length + " 个问题，修正后请重新选择文件："
        )
      );
      var list = utils.el("ul");
      errors.slice(0, 40).forEach(function (message) {
        list.appendChild(utils.el("li", "", i18n.translateMessage(message)));
      });
      if (errors.length > 40) {
        list.appendChild(utils.el("li", "", "其余 " + (errors.length - 40) + " 个问题未显示。"));
      }
      errorBox.appendChild(list);
    }

    var preview = utils.clear(dom["excel-import-preview"]);
    result.rows.slice(0, 20).forEach(function (row, index) {
      var tableRow = utils.el("tr");
      [
        index + 1,
        row.groupName,
        row.flowName || "—",
        row.taskName,
        row.ddl || "—",
        automation.cadenceLabel(row.recurrenceCadence) || i18n.cadenceLabels().none,
        urgencyLabels[row.urgency] || "中"
      ].forEach(function (value) {
        tableRow.appendChild(utils.el("td", "", value));
      });
      preview.appendChild(tableRow);
    });
    if (result.rows.length > 20) {
      var moreRow = utils.el("tr");
      var moreCell = utils.el(
        "td",
        "import-preview-more",
        "另有 " + (result.rows.length - 20) + " 条 Task，将在确认后一起导入"
      );
      moreCell.colSpan = 7;
      moreRow.appendChild(moreCell);
      preview.appendChild(moreRow);
    }

    dom["excel-import-confirm"].disabled = Boolean(errors.length || !result.rows.length);
    var appendMode = query('input[name="excel-import-mode"][value="append"]');
    if (appendMode) appendMode.checked = true;
    renderExcelImportMode();
    if (!dom["excel-import-dialog"].open) dom["excel-import-dialog"].showModal();
  }

  function openExcelFilePicker() {
    closeDetailsMenus();
    if (!excelImport || typeof excelImport.parseWorkbook !== "function") {
      toast("Excel 导入组件未加载，请刷新页面后重试。", "error", 6500);
      return;
    }
    dom["excel-file-input"].value = "";
    dom["excel-file-input"].click();
  }

  function importExcelFile(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast("Excel 文件不能超过 15 MB。", "error", 6500);
      return;
    }
    var reader = new FileReader();
    reader.onerror = function () {
      toast("无法读取所选 Excel 文件。", "error", 6500);
    };
    reader.onload = function () {
      renderExcelImportDialog(file, excelImport.parseWorkbook(reader.result));
    };
    reader.readAsArrayBuffer(file);
  }

  function closeExcelImportDialog() {
    ui.pendingExcelImport = null;
    if (dom["excel-import-dialog"].open) dom["excel-import-dialog"].close();
  }

  function attachImportedMaterial(link, type, taskId, stamp) {
    var key = materialUrlKey(link.url);
    var existing = data.materials.find(function (material) {
      return materialUrlKey(material.url) === key;
    });
    if (existing) {
      var previousCount = existing.taskIds.length;
      existing.taskIds = materialTools.uniqueIds(existing.taskIds.concat(taskId));
      if (existing.taskIds.length !== previousCount) existing.updatedAt = stamp;
      return existing;
    }
    var material = materialTools.makeMaterial(
      {
        id: utils.uid("material"),
        title: link.title,
        url: link.url,
        type: type,
        taskIds: [taskId]
      },
      stamp
    );
    data.materials.push(material);
    return material;
  }

  function importedRecurrenceState(row, existing) {
    var useLegacyRecurrence = Boolean(
      !row.recurrenceSpecified &&
        existing &&
        dates.isRecurringTask(existing) &&
        row.ddl >= existing.recurrenceStart &&
        row.ddl <= existing.recurrenceEnd
    );
    var cadence = useLegacyRecurrence
      ? dates.recurrenceCadence(existing)
      : row.recurrenceCadence;
    if (!automation.isCadence(cadence)) {
      return {
        recurrenceCadence: "none",
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceCompletions: [],
        status: row.status,
        completedAt:
          row.status === "completed" ? row.completedAt || dates.todayISO() : null
      };
    }

    var taskLike = {
      ddl: row.ddl,
      recurrenceCadence: cadence,
      recurrenceStart: useLegacyRecurrence
        ? existing.recurrenceStart
        : row.recurrenceStart,
      recurrenceEnd: useLegacyRecurrence ? existing.recurrenceEnd : row.recurrenceEnd,
      recurrenceCompletions: useLegacyRecurrence
        ? utils.clone(existing.recurrenceCompletions || [])
        : utils.clone(row.recurrenceCompletions || [])
    };
    if (row.status === "completed" && !taskLike.recurrenceCompletions.length) {
      var today = dates.todayISO();
      var completionDate = row.completedAt || today;
      var occurrences = dates.getRecurringOccurrences(taskLike);
      var currentKey = dates.recurrencePeriodKey(cadence, today);
      var targetIndex = occurrences.findIndex(function (occurrence) {
        return occurrence.periodKey === currentKey;
      });
      if (targetIndex < 0) {
        occurrences.forEach(function (occurrence, index) {
          if (occurrence.ddl <= completionDate) targetIndex = index;
        });
      }
      if (targetIndex >= 0) {
        taskLike.recurrenceCompletions = occurrences
          .slice(0, targetIndex + 1)
          .map(function (occurrence) {
            return {
              periodKey: occurrence.periodKey,
              occurrenceDdl: occurrence.ddl,
              completedAt: completionDate
            };
          });
      }
    }
    taskLike.recurrenceCompletions = automation.normalizeCompletions(taskLike);
    var state = dates.getTaskPeriodState(taskLike, new Date());
    return {
      recurrenceCadence: cadence,
      recurrenceStart: taskLike.recurrenceStart,
      recurrenceEnd: taskLike.recurrenceEnd,
      recurrenceCompletions: taskLike.recurrenceCompletions,
      status: state.completed ? "completed" : "pending",
      completedAt: state.completedAt || null
    };
  }

  function importedProgressEntries(row, existing, stamp) {
    var supplied = Array.isArray(row && row.progressEntries)
      ? row.progressEntries
      : [];
    if (supplied.length) {
      return supplied
        .map(function (entry) {
          return storage.normalizeProgressEntry(entry, {
            createdAt: stamp,
            updatedAt: stamp,
            sourceType: "excel-import"
          });
        })
        .filter(Boolean);
    }

    var aggregate = richText.normalizePlainText(row && row.progressNote, 32767);
    if (!aggregate) return [];
    if (
      existing &&
      Array.isArray(existing.progressEntries) &&
      existing.progressEntries.length &&
      richText.normalizePlainText(existing.progressNote, 32767) === aggregate
    ) {
      return utils.clone(existing.progressEntries);
    }
    return [
      storage.normalizeProgressEntry(
        {
          id: utils.uid("progress"),
          contentHtml: richText.fromPlainText(aggregate),
          contentText: aggregate,
          sourceType: "excel-import",
          createdAt: stamp,
          updatedAt: stamp
        },
        stamp
      )
    ].filter(Boolean);
  }

  function importedProgressState(row, existing, stamp) {
    var entries = importedProgressEntries(row, existing, stamp);
    var latest = richText.latestProgressEntry(entries);
    return {
      progressEntries: entries,
      progressNote: latest ? latest.contentText : "",
      progressUpdatedAt: latest ? latest.updatedAt : null
    };
  }

  function appendExcelRows(rows) {
    var stamp = new Date().toISOString();
    var groupByName = new Map();
    data.groups.forEach(function (group) {
      groupByName.set(normalizeImportName(group.name), group);
    });

    var newGroupSpecs = new Map();
    rows.forEach(function (row) {
      var key = normalizeImportName(row.groupName);
      if (groupByName.has(key)) return;
      if (!newGroupSpecs.has(key)) {
        newGroupSpecs.set(key, { name: row.groupName, color: row.groupColor || "" });
      } else if (!newGroupSpecs.get(key).color && row.groupColor) {
        newGroupSpecs.get(key).color = row.groupColor;
      }
    });
    var nextGroupOrder = data.groups.length
      ? Math.max.apply(
          null,
          data.groups.map(function (group) {
            return Number(group.order || 0);
          })
        ) + 1
      : 1;
    newGroupSpecs.forEach(function (spec, key) {
      var group = {
        id: utils.uid("group"),
        name: spec.name,
        color: spec.color || storage.nextGroupColor(data.groups),
        order: nextGroupOrder,
        collapsed: false,
        createdAt: stamp,
        updatedAt: stamp
      };
      nextGroupOrder += 1;
      data.groups.push(group);
      groupByName.set(key, group);
    });

    var flowByName = new Map();
    data.flows.forEach(function (flow) {
      var group = getGroup(flow.groupId);
      if (group) flowByName.set(importFlowKey(group.name, flow.name), flow);
    });
    var newFlowSpecs = new Map();
    rows.forEach(function (row) {
      if (!row.flowName) return;
      var key = importFlowKey(row.groupName, row.flowName);
      if (flowByName.has(key)) return;
      if (!newFlowSpecs.has(key)) {
        newFlowSpecs.set(key, {
          groupKey: normalizeImportName(row.groupName),
          name: row.flowName,
          color: row.flowColor || ""
        });
      } else if (!newFlowSpecs.get(key).color && row.flowColor) {
        newFlowSpecs.get(key).color = row.flowColor;
      }
    });
    var maxFlowOrderByGroup = new Map();
    data.flows.forEach(function (flow) {
      maxFlowOrderByGroup.set(
        flow.groupId,
        Math.max(maxFlowOrderByGroup.get(flow.groupId) || 0, Number(flow.order || 0))
      );
    });
    newFlowSpecs.forEach(function (spec, key) {
      var group = groupByName.get(spec.groupKey);
      var order = (maxFlowOrderByGroup.get(group.id) || 0) + 1;
      var flow = {
        id: utils.uid("flow"),
        groupId: group.id,
        name: spec.name,
        color: spec.color || group.color,
        order: order,
        collapsed: false,
        createdAt: stamp,
        updatedAt: stamp
      };
      data.flows.push(flow);
      flowByName.set(key, flow);
      maxFlowOrderByGroup.set(group.id, order);
    });

    var maxTaskOrderByFlow = new Map();
    data.tasks.forEach(function (task) {
      if (!task.flowId) return;
      maxTaskOrderByFlow.set(
        task.flowId,
        Math.max(maxTaskOrderByFlow.get(task.flowId) || 0, Number(task.flowOrder || 0))
      );
    });
    rows.forEach(function (row) {
      var group = groupByName.get(normalizeImportName(row.groupName));
      var flow = row.flowName ? flowByName.get(importFlowKey(row.groupName, row.flowName)) : null;
      var flowOrder = null;
      if (flow) {
        flowOrder = row.flowOrder || (maxTaskOrderByFlow.get(flow.id) || 0) + 1;
        maxTaskOrderByFlow.set(
          flow.id,
          Math.max(maxTaskOrderByFlow.get(flow.id) || 0, flowOrder)
        );
      }
      var recurrence = importedRecurrenceState(row, null);
      var progress = importedProgressState(row, null, stamp);
      var importedTask = {
        id: utils.uid("task"),
        groupId: group.id,
        flowId: flow ? flow.id : null,
        flowOrder: flowOrder,
        name: row.taskName,
        reportTo: canonicalTaskSuggestionValue("reportTo", row.reportTo),
        managedObject: canonicalTaskSuggestionValue("managedObject", row.managedObject),
        deliverable: row.deliverable,
        ddl: row.ddl,
        urgency: row.urgency,
        status: recurrence.status,
        completedAt: recurrence.completedAt,
        recurrenceCadence: recurrence.recurrenceCadence,
        recurrenceStart: recurrence.recurrenceStart,
        recurrenceEnd: recurrence.recurrenceEnd,
        recurrenceCompletions: recurrence.recurrenceCompletions,
        progressEntries: progress.progressEntries,
        progressNote: progress.progressNote,
        progressUpdatedAt: progress.progressUpdatedAt,
        createdAt: stamp,
        updatedAt: stamp
      };
      data.tasks.push(importedTask);
      row.documentLinks.forEach(function (link) {
        attachImportedMaterial(link, "document", importedTask.id, stamp);
      });
      row.deliverableLinks.forEach(function (link) {
        attachImportedMaterial(link, "deliverable", importedTask.id, stamp);
      });
    });
  }

  function taskImportKey(groupName, flowName, taskName) {
    return [
      normalizeImportName(groupName),
      normalizeImportName(flowName),
      normalizeImportName(taskName)
    ].join("::");
  }

  function replaceExcelRows(rows) {
    var stamp = new Date().toISOString();
    var existingGroupById = new Map();
    var existingGroupByName = new Map();
    data.groups.forEach(function (group) {
      existingGroupById.set(group.id, group);
      existingGroupByName.set(normalizeImportName(group.name), group);
    });
    var existingFlowById = new Map();
    var existingFlowByName = new Map();
    data.flows.forEach(function (flow) {
      var group = existingGroupById.get(flow.groupId);
      existingFlowById.set(flow.id, flow);
      if (group) existingFlowByName.set(importFlowKey(group.name, flow.name), flow);
    });
    var existingTaskQueues = new Map();
    data.tasks.forEach(function (task) {
      var group = existingGroupById.get(task.groupId);
      var flow = task.flowId ? existingFlowById.get(task.flowId) : null;
      if (!group) return;
      var key = taskImportKey(group.name, flow ? flow.name : "", task.name);
      if (!existingTaskQueues.has(key)) existingTaskQueues.set(key, []);
      existingTaskQueues.get(key).push(task);
    });

    var groupSpecs = new Map();
    rows.forEach(function (row) {
      var key = normalizeImportName(row.groupName);
      if (!groupSpecs.has(key)) {
        groupSpecs.set(key, { name: row.groupName, color: row.groupColor || "" });
      } else if (!groupSpecs.get(key).color && row.groupColor) {
        groupSpecs.get(key).color = row.groupColor;
      }
    });
    var nextGroups = [];
    var groupByName = new Map();
    groupSpecs.forEach(function (spec, key) {
      var existing = existingGroupByName.get(key);
      var group = {
        id: existing ? existing.id : utils.uid("group"),
        name: spec.name,
        color:
          spec.color ||
          (existing && existing.color) ||
          storage.nextGroupColor(nextGroups),
        order: nextGroups.length + 1,
        collapsed: existing ? existing.collapsed : false,
        createdAt: existing ? existing.createdAt : stamp,
        updatedAt: stamp
      };
      nextGroups.push(group);
      groupByName.set(key, group);
    });

    var flowSpecs = new Map();
    rows.forEach(function (row) {
      if (!row.flowName) return;
      var key = importFlowKey(row.groupName, row.flowName);
      if (!flowSpecs.has(key)) {
        flowSpecs.set(key, {
          groupKey: normalizeImportName(row.groupName),
          name: row.flowName,
          color: row.flowColor || ""
        });
      } else if (!flowSpecs.get(key).color && row.flowColor) {
        flowSpecs.get(key).color = row.flowColor;
      }
    });
    var nextFlows = [];
    var flowByName = new Map();
    var nextFlowOrderByGroup = new Map();
    flowSpecs.forEach(function (spec, key) {
      var group = groupByName.get(spec.groupKey);
      var existing = existingFlowByName.get(key);
      var order = (nextFlowOrderByGroup.get(group.id) || 0) + 1;
      var flow = {
        id: existing ? existing.id : utils.uid("flow"),
        groupId: group.id,
        name: spec.name,
        color: spec.color || (existing && existing.color) || group.color,
        order: order,
        collapsed: existing ? existing.collapsed : false,
        createdAt: existing ? existing.createdAt : stamp,
        updatedAt: stamp
      };
      nextFlows.push(flow);
      flowByName.set(key, flow);
      nextFlowOrderByGroup.set(group.id, order);
    });

    var nextTasks = [];
    var maxTaskOrderByFlow = new Map();
    rows.forEach(function (row) {
      var group = groupByName.get(normalizeImportName(row.groupName));
      var flow = row.flowName
        ? flowByName.get(importFlowKey(row.groupName, row.flowName))
        : null;
      var queue = existingTaskQueues.get(
        taskImportKey(row.groupName, row.flowName, row.taskName)
      );
      var existing = queue && queue.length ? queue.shift() : null;
      var recurrence = importedRecurrenceState(row, existing);
      var progress = importedProgressState(row, existing, stamp);
      var flowOrder = null;
      if (flow) {
        flowOrder = row.flowOrder || (maxTaskOrderByFlow.get(flow.id) || 0) + 1;
        maxTaskOrderByFlow.set(
          flow.id,
          Math.max(maxTaskOrderByFlow.get(flow.id) || 0, flowOrder)
        );
      }
      nextTasks.push({
        id: existing ? existing.id : utils.uid("task"),
        groupId: group.id,
        flowId: flow ? flow.id : null,
        flowOrder: flowOrder,
        name: row.taskName,
        reportTo: canonicalTaskSuggestionValue("reportTo", row.reportTo),
        managedObject: canonicalTaskSuggestionValue("managedObject", row.managedObject),
        deliverable: row.deliverable,
        ddl: row.ddl,
        urgency: row.urgency,
        status: recurrence.status,
        completedAt: recurrence.completedAt,
        recurrenceCadence: recurrence.recurrenceCadence,
        recurrenceStart: recurrence.recurrenceStart,
        recurrenceEnd: recurrence.recurrenceEnd,
        recurrenceCompletions: recurrence.recurrenceCompletions,
        progressEntries: progress.progressEntries,
        progressNote: progress.progressNote,
        progressUpdatedAt: progress.progressUpdatedAt,
        createdAt: existing ? existing.createdAt : stamp,
        updatedAt: stamp
      });
    });

    data.groups = nextGroups;
    data.flows = nextFlows;
    data.tasks = nextTasks;
    var validGroupIds = new Set(nextGroups.map(function (group) {
      return group.id;
    }));
    var validFlowIds = new Set(nextFlows.map(function (flow) {
      return flow.id;
    }));
    var validTaskIds = new Set(nextTasks.map(function (task) {
      return task.id;
    }));
    data.materials.forEach(function (material) {
      var previousRelationCount =
        material.taskIds.length + material.flowIds.length + material.groupIds.length;
      material.taskIds = material.taskIds.filter(function (id) {
        return validTaskIds.has(id);
      });
      material.flowIds = material.flowIds.filter(function (id) {
        return validFlowIds.has(id);
      });
      material.groupIds = material.groupIds.filter(function (id) {
        return validGroupIds.has(id);
      });
      if (
        previousRelationCount !==
        material.taskIds.length + material.flowIds.length + material.groupIds.length
      ) {
        material.updatedAt = stamp;
      }
    });

    nextTasks.forEach(function (task) {
      data.materials.forEach(function (material) {
        if (!["document", "deliverable"].includes(material.type)) return;
        var previousCount = material.taskIds.length;
        material.taskIds = material.taskIds.filter(function (id) {
          return id !== task.id;
        });
        if (material.taskIds.length !== previousCount) material.updatedAt = stamp;
      });
    });
    rows.forEach(function (row, index) {
      var task = nextTasks[index];
      row.documentLinks.forEach(function (link) {
        attachImportedMaterial(link, "document", task.id, stamp);
      });
      row.deliverableLinks.forEach(function (link) {
        attachImportedMaterial(link, "deliverable", task.id, stamp);
      });
    });
  }

  function applyExcelRows(rows, mode) {
    if (mode === "replace") {
      replaceExcelRows(rows);
      return;
    }
    appendExcelRows(rows);
  }

  function confirmExcelImport() {
    var pending = ui.pendingExcelImport;
    if (
      ui.isImportingExcel ||
      !pending ||
      !pending.rows.length ||
      pending.errors.length
    ) {
      return;
    }
    var modeInput = query('input[name="excel-import-mode"]:checked');
    var mode = modeInput ? modeInput.value : "append";
    if (mode === "replace") {
      if (
        !confirmAction(
          "完整覆盖会以本文件中的 " +
            pending.summary.groupCount +
            " 个分组、" +
            pending.summary.flowCount +
            " 个 Flow 和 " +
            pending.rows.length +
            " 条 Task，替换当前全部时间轴数据。资料库的 " +
            data.materials.length +
            " 条资料不会删除；同名层级会尽量保留原有关联。是否继续？"
        )
      ) {
        return;
      }
      if (
        !confirmAction(
          "再次确认：文件中没有的分组、Flow 和 Task 将被移除，无法匹配的资料关联也会移除。建议已先导出 JSON 备份。"
        )
      ) {
        return;
      }
    }
    ui.isImportingExcel = true;
    dom["excel-import-confirm"].disabled = true;
    dom["excel-import-confirm"].textContent = "正在导入…";
    var backup = utils.clone(data);
    try {
      applyExcelRows(pending.rows, mode);
      var successMessage =
        mode === "replace"
          ? "已完整覆盖时间轴，共导入 " + pending.rows.length + " 条 Task"
          : "已补充导入 " + pending.rows.length + " 条 Task";
      if (!persistAndRender(successMessage)) {
        data = backup;
        renderAll();
        return;
      }
      closeExcelImportDialog();
      ui.timelineMode = "all";
      ui.filters = {
        search: "",
        groupIds: [],
        flowId: "all",
        status: "all",
        urgency: "all",
        overdueOnly: false
      };
      switchView("timeline");
      renderFilteredViews();
    } catch (error) {
      data = backup;
      renderAll();
      toast("Excel 导入失败：" + error.message, "error", 7500);
    } finally {
      ui.isImportingExcel = false;
      dom["excel-import-confirm"].disabled = false;
      if (ui.pendingExcelImport) {
        renderExcelImportMode();
      } else {
        dom["excel-import-confirm"].textContent = "确认补充导入";
      }
    }
  }

  function exportTaskImportData() {
    closeDetailsMenus();
    if (!excelImport || typeof excelImport.exportWorkbook !== "function") {
      toast("可回导 Excel 组件未加载，请刷新页面后重试。", "error", 6500);
      return;
    }
    var filename =
      (i18n.isEnglish() ? "Weekflow_Current_Task_Data_" : "Weekflow_Task当前数据_") +
      dates.dateTimeStamp(new Date()) +
      ".xlsx";
    excelImport
      .exportWorkbook(data, window.JSZip, filename)
      .then(function (result) {
        utils.downloadBlob(result.blob, result.filename);
        toast("已按导入模板下载当前数据：" + result.filename);
      })
      .catch(function (error) {
        toast("当前数据下载失败：" + error.message, "error", 7000);
      });
  }

  function exportExcel(button) {
    if (ui.isExporting) return;
    ui.isExporting = true;
    button.disabled = true;
    var original = button.textContent;
    button.textContent = "正在导出…";
    window.setTimeout(function () {
      excelExport
        .exportWorkbook(data, window.JSZip, new Date())
        .then(function (result) {
          utils.downloadBlob(result.blob, result.filename);
          toast("看板报告已导出：" + result.filename);
        })
        .catch(function (error) {
          toast("看板报告导出失败：" + error.message, "error", 7000);
        })
        .finally(function () {
          ui.isExporting = false;
          button.disabled = false;
          button.textContent = original;
        });
    }, 30);
  }

  function exportPersonTaskStatus(button) {
    if (ui.isExportingPersonStatus || !button) return;
    if (!excelExport || typeof excelExport.exportTaskStatusWorkbook !== "function") {
      toast("人员 Task 状态导出组件未加载，请刷新页面后重试。", "error", 6500);
      return;
    }
    var config = {
      field: button.dataset.scopeField,
      value: button.dataset.scopeValue || "",
      label: button.dataset.scopeLabel || "",
      language: i18n.getLanguage()
    };
    ui.isExportingPersonStatus = true;
    button.disabled = true;
    var original = button.textContent;
    button.textContent = "导出中…";
    window.setTimeout(function () {
      excelExport
        .exportTaskStatusWorkbook(data, window.JSZip, config, new Date())
        .then(function (result) {
          utils.downloadBlob(result.blob, result.filename);
          toast("Task 状态已导出：" + result.filename);
        })
        .catch(function (error) {
          toast("Task 状态导出失败：" + error.message, "error", 7000);
        })
        .finally(function () {
          ui.isExportingPersonStatus = false;
          button.disabled = false;
          button.textContent = original;
        });
    }, 30);
  }

  function exportJsonBackup() {
    closeDetailsMenus();
    try {
      var blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8"
      });
      var filename =
        (i18n.isEnglish() ? "Weekflow_Data_Backup_" : "Task数据备份_") +
        dates.dateTimeStamp(new Date()) +
        ".json";
      utils.downloadBlob(blob, filename);
      toast("JSON 备份已导出");
    } catch (error) {
      toast("备份导出失败：" + error.message, "error");
    }
  }

  function importJsonFile(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onerror = function () {
      toast("无法读取所选文件。", "error");
    };
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || ""));
        var checked = storage.validateData(parsed);
        if (!checked.valid) throw new Error(checked.errors.slice(0, 6).join("；"));
        if (
          !confirmAction(
            "确认用该备份替换当前数据？将导入 " +
              checked.data.groups.length +
              " 个分组和 " +
              checked.data.tasks.length +
              " 条 Task、" +
              checked.data.materials.length +
              " 条资料。"
          )
        ) {
          return;
        }
        try {
          localStorage.setItem(
            "weekflow-v2.4:pre-import-backup",
            JSON.stringify(data)
          );
        } catch (_error) {
          /* 备份失败不阻断用户明确确认的导入。 */
        }
        data = checked.data;
        if (persistAndRender("JSON 数据已恢复")) {
          ui.timelineMode = "all";
          renderTimeline();
        }
      } catch (error) {
        toast("导入失败：" + error.message, "error", 8000);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function closeDetailsMenus() {
    queryAll("details[open]").forEach(function (details) {
      details.open = false;
    });
  }

  function closeDdlReminder() {
    if (ui.ddlReminderTimer) {
      window.clearTimeout(ui.ddlReminderTimer);
      ui.ddlReminderTimer = null;
    }
    dom["ddl-reminder"].hidden = true;
  }

  function scheduleNextPeriodRefresh() {
    if (ui.recurrenceRefreshTimer) {
      window.clearTimeout(ui.recurrenceRefreshTimer);
    }
    var now = new Date();
    var nextDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      2
    );
    ui.recurrenceRefreshTimer = window.setTimeout(function () {
      var result = automation.syncRecurringTaskStates(data, new Date());
      if (result.changed) {
        try {
          data = storage.save(data);
        } catch (error) {
          toast("周期状态刷新失败：" + error.message, "error", 6500);
        }
      }
      renderAll();
      showDdlReminder();
      scheduleNextPeriodRefresh();
    }, Math.max(1000, nextDay.getTime() - now.getTime()));
  }

  function dueReminderLabel(ddl, today) {
    var days = dates.daysBetween(today, ddl);
    if (days === 0) return "今天";
    if (days === 1) return "明天";
    return days + " 天后";
  }

  function showDdlReminder() {
    closeDdlReminder();
    var today = dates.todayISO();
    var tasks = automation.getDueSoonTasks(data, new Date(), 7);
    var list = utils.clear(dom["ddl-reminder-list"]);
    dom["ddl-reminder-summary"].textContent = tasks.length
      ? tasks.length + " 条未完成 Task 即将到期"
      : "当前没有临期未完成 Task";
    if (!tasks.length) {
      list.appendChild(utils.el("p", "ddl-reminder-empty", "未来 7 天可以从容安排。"));
    } else {
      tasks.slice(0, 5).forEach(function (entry) {
        var task = entry.task;
        var item = utils.el("div", "ddl-reminder-item");
        item.append(
          utils.el("span", "", task.name),
          utils.el("time", "", entry.ddl + " · " + dueReminderLabel(entry.ddl, today))
        );
        list.appendChild(item);
      });
      if (tasks.length > 5) {
        list.appendChild(
          utils.el("p", "ddl-reminder-empty", "另有 " + (tasks.length - 5) + " 条未显示")
        );
      }
    }
    dom["ddl-reminder"].hidden = false;
    ui.ddlReminderTimer = window.setTimeout(closeDdlReminder, 10000);
  }

  function toast(message, type, duration) {
    message = i18n.translateMessage(message);
    var node = utils.el("div", "toast" + (type ? " " + type : ""), message);
    dom["toast-region"].appendChild(node);
    window.setTimeout(function () {
      node.remove();
    }, duration || 4000);
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
