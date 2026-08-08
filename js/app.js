/* Weekflow 主应用：渲染、交互与 CRUD。 */
(function () {
  "use strict";

  var App = window.App;
  var utils = App.utils;
  var dates = App.dateUtils;
  var stats = App.stats;
  var storage = App.storage;
  var excelExport = App.excelExport;
  var excelImport = App.excelImport;
  var materialTools = App.materials;
  var materialExcel = App.materialExcel;
  var automation = App.automation;

  var urgencyLabels = { high: "高", medium: "中", low: "低" };
  var statusLabels = { pending: "未完成", completed: "已完成" };
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
    timelineMode: "window",
    timelineAnchor: dates.getWeekFriday(new Date()),
    windowPastWeeks: 4,
    windowFutureWeeks: 11,
    dashboardModule: null,
    taskDraftMaterials: [],
    managedMaterials: [],
    managedTaskId: null,
    managedProgressTaskId: null,
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
    deletingGroupId: null,
    isSavingTask: false,
    isExporting: false,
    isExportingPersonStatus: false,
    isImportingExcel: false,
    pendingExcelImport: null,
    pendingMaterialImport: null,
    isImportingMaterials: false,
    ddlReminderTimer: null,
    recurrenceRefreshTimer: null
  };

  var dom = {};

  function query(selector, root) {
    return (root || document).querySelector(selector);
  }

  function queryAll(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function cacheDom() {
    [
      "home-view",
      "timeline-view",
      "dashboard-view",
      "materials-view",
      "filter-bar",
      "materials-filter-bar",
      "home-task-total",
      "home-completion-rate",
      "home-group-total",
      "home-flow-total",
      "home-material-total",
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
      "range-label",
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
      "materials-table-body",
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
      "progress-dialog",
      "progress-form",
      "progress-dialog-task",
      "progress-dialog-updated",
      "progress-note",
      "progress-character-count",
      "progress-save-button",
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
      "toast-region"
    ].forEach(function (id) {
      dom[id] = document.getElementById(id);
    });
  }

  function initialize() {
    cacheDom();
    bindEvents();
    var recurrenceSync = automation.syncRecurringTaskStates(data, new Date());
    if (recurrenceSync.changed) {
      try {
        data = storage.save(data);
      } catch (_error) {
        /* 后续正常渲染，并由保存流程报告具体存储问题。 */
      }
    }
    renderAll();
    var warning = storage.getLastWarning();
    if (warning) toast(warning, "warning", 7000);
    showDdlReminder();
    scheduleNextPeriodRefresh();
  }

  function bindEvents() {
    document.addEventListener("click", handleActionClick);
    document.addEventListener("click", closeOtherPopoverMenus);
    document.addEventListener("keydown", handleKeyboard);

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
    dom["progress-form"].addEventListener("submit", saveProgressNote);
    dom["progress-note"].addEventListener("input", updateProgressCharacterCount);
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
    dom["materials-table-body"].addEventListener("change", function (event) {
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
    });
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

  function handleKeyboard(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (ui.view === "home" || ui.view === "dashboard") switchView("timeline");
      requestAnimationFrame(function () {
        var search =
          ui.view === "materials" ? dom["material-filter-name"] : dom["filter-search"];
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
  }

  function handleActionClick(event) {
    if (event.target.closest(".materials-download-popover a")) {
      window.setTimeout(closeDetailsMenus, 0);
    }

    var viewButton = event.target.closest("[data-view]");
    if (viewButton) {
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
      "new-group": openNewGroup,
      "new-flow": function () {
        openNewFlow();
      },
      "new-task": openNewTask,
      "new-material": function () {
        openMaterialDialog();
      },
      "close-group-dialog": function () {
        dom["group-dialog"].close();
      },
      "close-task-dialog": function () {
        dom["task-dialog"].close();
      },
      "close-flow-dialog": closeFlowDialog,
      "close-link-dialog": function () {
        dom["link-dialog"].close();
      },
      "close-material-dialog": function () {
        dom["material-dialog"].close();
      },
      "close-progress-dialog": function () {
        dom["progress-dialog"].close();
      },
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

  function getMaterial(id) {
    return data.materials.find(function (material) {
      return material.id === id;
    });
  }

  function getTaskMaterials(taskId) {
    return materialTools.forTask(data.materials, taskId);
  }

  function getVisibleTasks() {
    var visible = stats.filterTasks(data.tasks, ui.filters, new Date(), data.flows);
    if (!ui.filters.search) return visible;
    var materialTaskIds = new Set();
    var needle = utils.normalizeText(ui.filters.search);
    data.materials.forEach(function (material) {
      var haystack = utils.normalizeText(
        [material.title, material.url, materialTools.TYPE_LABELS[material.type], material.note].join(
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
    return stats.sortTasks(visible, new Date());
  }

  function getTimelineWeeks() {
    if (ui.timelineMode === "all") {
      return excelExport.timelineWeeks(data.tasks, new Date());
    }
    var start = dates.addWeeksFriday(ui.timelineAnchor, -ui.windowPastWeeks);
    var end = dates.addWeeksFriday(ui.timelineAnchor, ui.windowFutureWeeks);
    return dates.buildWeekRange(start, end);
  }

  function renderTimeline() {
    var visibleTasks = getVisibleTasks();
    var weeks = getTimelineWeeks();
    var board = utils.clear(dom["timeline-board"]);
    board.style.setProperty("--week-count", weeks.length);
    dom["visible-result-count"].textContent = visibleTasks.length + " 条可见 Task";
    dom["range-label"].textContent = weeks.length
      ? weeks[0] + " — " + weeks[weeks.length - 1] + " · " + weeks.length + " 周"
      : "";

    if (!data.groups.length) {
      board.appendChild(
        createEmptyState(
          "先建立第一个分组",
          "Task 必须归属分组。建立分组后即可开始安排周时间轴。",
          "新建分组",
          openNewGroup
        )
      );
      return;
    }
    if (hasActiveFilters() && visibleTasks.length === 0) {
      board.appendChild(
        createEmptyState(
          "没有符合条件的 Task",
          "尝试减少筛选条件，或清空筛选查看全部 Task。",
          "清空筛选",
          clearFilters
        )
      );
      return;
    }

    board.appendChild(createTimelineHeader(weeks));
    var visibleIds = new Set(
      visibleTasks.map(function (task) {
        return task.id;
      })
    );
    var groupsToShow = getSortedGroups().filter(function (group) {
      if (!hasActiveFilters()) return true;
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
          !hasActiveFilters() ||
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
      board.appendChild(createGroupRow(group, groupTasks, weeks));
      if (!group.collapsed) {
        groupFlows.forEach(function (flow) {
          var flowTasks = stats.sortFlowTasks(
            groupTasks.filter(function (task) {
              return task.flowId === flow.id;
            }),
            new Date()
          );
          board.appendChild(createFlowRow(flow, group, flowTasks, weeks));
          if (!flow.collapsed) {
            if (!flowTasks.length) board.appendChild(createEmptyFlowRow(flow, group, weeks));
            flowTasks.forEach(function (task) {
              board.appendChild(createTaskRow(task, group, weeks, flow, task.flowOrder));
            });
          }
        });
        standaloneTasks.forEach(function (task) {
          board.appendChild(createTaskRow(task, group, weeks, null, null));
        });
        if (!groupTasks.length && !groupFlows.length) {
          board.appendChild(createEmptyGroupRow(group, weeks));
        }
      }
    });
  }

  function createTimelineHeader(weeks) {
    var row = utils.el("div", "timeline-header");
    var corner = utils.el("div", "timeline-corner");
    ["Task / DDL", "紧急", "进度记录", "相关资料", "编辑"].forEach(function (label) {
      corner.appendChild(utils.el("span", "", label));
    });
    row.appendChild(corner);
    var currentFriday = dates.getWeekFriday(new Date());
    weeks.forEach(function (friday) {
      var head = utils.el("div", "week-head" + (friday === currentFriday ? " is-current" : ""));
      head.dataset.week = friday;
      head.appendChild(utils.el("small", "week-range", dates.friendlyWeekLabel(friday)));
      head.appendChild(utils.el("strong", "week-date", friday.slice(5).replace("-", "/")));
      head.appendChild(utils.el("span", "week-year", friday.slice(0, 4) + " · 周五"));
      if (friday === currentFriday) {
        head.appendChild(utils.el("b", "week-current-badge", "本周"));
      }
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

  function createGroupRow(group, groupTasks, weeks) {
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

    var currentFriday = dates.getWeekFriday(new Date());
    weeks.forEach(function (friday) {
      row.appendChild(
        utils.el("div", "group-week-cell" + (friday === currentFriday ? " is-current" : ""))
      );
    });
    return row;
  }

  function createFlowRow(flow, group, flowTasks, weeks) {
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

    var currentFriday = dates.getWeekFriday(new Date());
    weeks.forEach(function (friday) {
      row.appendChild(
        utils.el("div", "flow-week-cell" + (friday === currentFriday ? " is-current" : ""))
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

  function createEmptyGroupRow(group, weeks) {
    var row = utils.el("div", "task-row");
    applyGroupVariables(row, group);
    var info = utils.el("div", "task-info");
    var message = utils.el("div", "task-main");
    message.appendChild(utils.el("span", "task-meta", "该分组还没有 Task"));
    info.appendChild(message);
    row.appendChild(info);
    var currentFriday = dates.getWeekFriday(new Date());
    weeks.forEach(function (friday) {
      row.appendChild(
        utils.el("div", "timeline-cell" + (friday === currentFriday ? " is-current" : ""))
      );
    });
    return row;
  }

  function createEmptyFlowRow(flow, group, weeks) {
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
    var currentFriday = dates.getWeekFriday(new Date());
    weeks.forEach(function (friday) {
      row.appendChild(
        utils.el("div", "timeline-cell" + (friday === currentFriday ? " is-current" : ""))
      );
    });
    return row;
  }

  function createTaskRow(task, group, weeks, flow, stepNumber) {
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
      recurring
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
    if (checkbox.disabled) checkbox.title = "进入有效自然周期后可确认本期完成状态";
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
      utils.el("span", "", (recurring ? "DDL 基准 " : "DDL ") + task.ddl)
    );
    if (recurring) {
      meta.appendChild(
        utils.el(
          "span",
          "recurrence-badge",
          automation.CADENCE_LABELS[periodState.cadence] +
            " · " +
            task.recurrenceStart +
            " 至 " +
            task.recurrenceEnd
        )
      );
    }
    if (overdue) {
      meta.appendChild(utils.el("span", "status-label overdue", "⚠ 本期逾期"));
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
            ? "周期未开始"
            : today > task.recurrenceEnd
              ? "周期已结束"
              : "本期无 DDL"
        )
      );
    } else {
      meta.appendChild(utils.el("span", "status-label", recurring ? "本期未完成" : "未完成"));
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
    editButton.title = "编辑 Task";
    editButton.setAttribute("aria-label", "编辑 " + task.name);
    editButton.addEventListener("click", function () {
      openEditTask(task.id);
    });
    info.append(main, urgency, progressButton, materialButton, editButton);
    row.appendChild(info);

    var occurrences = recurring
      ? dates.getRecurringOccurrences(task)
      : [{ ddl: task.ddl, periodKey: "" }];
    var occurrencesByFriday = new Map();
    occurrences.forEach(function (occurrence) {
      var friday = dates.getWeekFriday(occurrence.ddl);
      if (!occurrencesByFriday.has(friday)) occurrencesByFriday.set(friday, []);
      occurrencesByFriday.get(friday).push(occurrence);
    });
    var currentFriday = dates.getWeekFriday(new Date());
    weeks.forEach(function (friday) {
      var cell = utils.el(
        "div",
        "timeline-cell" + (friday === currentFriday ? " is-current" : "")
      );
      (occurrencesByFriday.get(friday) || []).forEach(function (occurrence) {
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
    return [
      task.name,
      "分组：" + group.name,
      flow ? "Flow：" + flow.name + " · STEP " + String(task.flowOrder || 1).padStart(2, "0") : "",
      recurring
        ? "周期：" + automation.CADENCE_LABELS[dates.recurrenceCadence(task)] +
          " · " + task.recurrenceStart + " 至 " + task.recurrenceEnd
        : "",
      "DDL：" + occurrence.ddl + "（周五 " + dates.getWeekFriday(occurrence.ddl) + "）",
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
    var hasProgress = Boolean(String(task.progressNote || "").trim());
    var button = utils.el(
      "button",
      "link-button progress-button" + (hasProgress ? " has-progress" : ""),
      "进度（" + (hasProgress ? "1" : "0") + "）"
    );
    button.type = "button";
    button.title = hasProgress
      ? "双击编辑进度记录\n" + task.progressNote.replace(/\s+/g, " ").slice(0, 160)
      : "双击添加进度记录";
    button.setAttribute(
      "aria-label",
      "进度记录，" + (hasProgress ? "已有内容" : "暂无内容") + "；双击或按回车编辑"
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
      "资料（" + materials.length + "）"
    );
    button.type = "button";
    button.title = "双击管理相关资料";
    button.setAttribute(
      "aria-label",
      "相关资料，" + materials.length + " 条；双击或按回车管理"
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

  function shiftTimeline(weeks) {
    ui.timelineMode = "window";
    ui.timelineAnchor = dates.addWeeksFriday(ui.timelineAnchor, weeks);
    renderTimeline();
  }

  function returnToCurrentWeek() {
    ui.timelineMode = "window";
    ui.timelineAnchor = dates.getWeekFriday(new Date());
    renderTimeline();
    requestAnimationFrame(scrollToCurrentWeek);
  }

  function showAllTaskRange() {
    ui.timelineMode = "all";
    renderTimeline();
    toast("已显示最早至最晚 DDL 的全部周范围");
  }

  function scrollToCurrentWeek() {
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
        label: materialTools.TYPE_LABELS[type],
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
          left.name.localeCompare(right.name, "zh-CN", { numeric: true })
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

  function materialMatchesFilters(material) {
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
      filters.taskIds.length &&
      !filters.taskIds.some(function (id) {
        return relations.taskIds.includes(id);
      })
    ) {
      return false;
    }
    if (
      filters.flowIds.length &&
      !filters.flowIds.some(function (id) {
        return relations.flowIds.includes(id);
      })
    ) {
      return false;
    }
    if (filters.groupIds.length) {
      var groupMatch = filters.groupIds.some(function (id) {
        return id === "__ungrouped__"
          ? relations.groupIds.length === 0
          : relations.groupIds.includes(id);
      });
      if (!groupMatch) return false;
    }
    if (
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
        materialTools.TYPE_LABELS[material.type]
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

  function getVisibleMaterials() {
    return materialTools
      .sortByGroup(data.materials, data)
      .filter(materialMatchesFilters);
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
    queryAll("[data-material-select]", dom["materials-table-body"]).forEach(
      function (checkbox) {
        checkbox.checked = selectedIds.has(checkbox.value);
      }
    );
  }

  function renderMaterialLibrary() {
    dom["material-filter-name"].value = ui.materialFilters.name;
    renderMaterialFilterOptions();

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
        data.materials.length
          ? "没有符合当前筛选条件的资料。"
          : "还没有资料，可手动添加或上传。"
      );
      emptyCell.colSpan = 8;
      emptyRow.appendChild(emptyCell);
      body.appendChild(emptyRow);
      return;
    }
    visible.forEach(function (material) {
      body.appendChild(createMaterialTableRow(material));
    });
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
      !window.confirm(
        "确认删除选中的 " + ids.length + " 条资料？它们会从所有相关 Task 中同步移除。"
      )
    ) {
      return;
    }
    if (!window.confirm("再次确认：批量删除资料不可恢复，是否继续？")) return;
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
    materialTools.recordOpen(material, new Date());
    try {
      data = storage.save(data);
      renderMaterialLibrary();
    } catch (error) {
      toast("打开次数保存失败：" + error.message, "warning", 5500);
    }
    utils.safeOpen(material.url);
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
    var nextView = ["home", "timeline", "dashboard", "materials"].includes(view)
      ? view
      : "home";
    if (nextView === "dashboard" && ui.view !== "dashboard") {
      ui.dashboardModule = null;
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
    dom["filter-bar"].hidden = ui.view !== "timeline";
    dom["materials-filter-bar"].hidden = ui.view !== "materials";
    var simplifiedHeader = ui.view === "dashboard" || ui.view === "materials";
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
    if (error) error.textContent = message;
  }

  function openNewGroup() {
    clearFieldErrors(dom["group-form"]);
    dom["group-dialog-title"].textContent = "新建分组";
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
    dom["group-dialog-title"].textContent = "编辑分组";
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
    dom["flow-dialog-title"].textContent = "新建 Flow";
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
    dom["flow-dialog-title"].textContent = "编辑 Flow";
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
    dom["flow-task-count"].textContent = flowTasks.length + " 个步骤";
    if (!flowTasks.length) {
      container.appendChild(
        utils.el(
          "p",
          "flow-order-empty",
          flowId
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
      handle.title = "拖动调整顺序";
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
      up.title = "上移";
      up.setAttribute("aria-label", "上移 " + task.name);
      up.disabled = index === 0;
      up.addEventListener("click", function () {
        moveFlowOrderItem(item, -1);
      });
      var down = utils.el("button", "", "↓");
      down.type = "button";
      down.title = "下移";
      down.setAttribute("aria-label", "下移 " + task.name);
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
    dom["flow-task-count"].textContent = items.length + " 个步骤";
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
    if (!window.confirm(message)) return;
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
      if (!window.confirm(emptyGroupMessage)) return;
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
      !window.confirm(
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
      !window.confirm(
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

  function populateTaskGroupSelect(selectedId) {
    var select = utils.clear(dom["task-group"]);
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
        return left.localeCompare(right, "zh-CN", { sensitivity: "base", numeric: true });
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
    var none = utils.el("option", "", "不加入 Flow");
    none.value = "";
    select.appendChild(none);
    getSortedFlows(groupId).forEach(function (flow) {
      var taskCount = data.tasks.filter(function (task) {
        return task.flowId === flow.id;
      }).length;
      var option = utils.el("option", "", flow.name + " · " + taskCount + " 个步骤");
      option.value = flow.id;
      select.appendChild(option);
    });
    var create = utils.el("option", "", "＋ 创建新的 Flow…");
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
    dom["task-recurrence-help"].textContent = recurring
      ? automation.CADENCE_LABELS[cadence] +
        "显示多个 DDL，但只统计为一个 Task；完成勾选仅对应当前自然" +
        (cadence === "weekly" ? "周" : "月") +
        "。"
      : "不重复的 Task 只在其 DDL 所在周显示一次。";
    dom["task-status-help"].textContent = recurring
      ? "周期 Task 的状态由当前自然" +
        (cadence === "weekly" ? "周" : "月") +
        "完成记录自动维护，请在时间轴勾选。"
      : "非周期 Task 可在此设置整体完成状态。";
    syncCompletedDate();
  }

  function openNewTask() {
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
      return;
    }
    var completed = dom["task-status"].value === "completed";
    dom["task-completed-at"].disabled = !completed;
    if (completed && !dom["task-completed-at"].value) {
      dom["task-completed-at"].value = dates.todayISO();
    }
    if (!completed) dom["task-completed-at"].value = "";
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
      var heading = utils.el("h4", "", materialTools.TYPE_LABELS[type]);
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
          var option = utils.el("option", "", materialTools.TYPE_LABELS[value]);
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
      dom["task-dialog"].close();
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
    if (!window.confirm("确认删除 Task「" + task.name + "」？此操作不可恢复。")) return;
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
    dom["progress-dialog-task"].textContent =
      task.name + " · 自由记录当前进展、阻塞事项或下一步计划";
    dom["progress-note"].value = task.progressNote || "";
    dom["progress-dialog-updated"].textContent = task.progressUpdatedAt
      ? "最后更新：" + formatProgressTimestamp(task.progressUpdatedAt)
      : "尚未记录进度";
    updateProgressCharacterCount();
    dom["progress-dialog"].showModal();
    setTimeout(function () {
      dom["progress-note"].focus();
      dom["progress-note"].setSelectionRange(
        dom["progress-note"].value.length,
        dom["progress-note"].value.length
      );
    }, 0);
  }

  function formatProgressTimestamp(value) {
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "未知时间";
    return parsed.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function updateProgressCharacterCount() {
    dom["progress-character-count"].textContent =
      dom["progress-note"].value.length + " / 4000";
  }

  function saveProgressNote(event) {
    event.preventDefault();
    var task = getTask(ui.managedProgressTaskId);
    if (!task) {
      toast("Task 不存在，无法保存进度记录。", "error");
      return;
    }
    dom["progress-save-button"].disabled = true;
    var note = dom["progress-note"].value.trim().slice(0, 4000);
    var stamp = new Date().toISOString();
    task.progressNote = note;
    task.progressUpdatedAt = note ? stamp : null;
    task.updatedAt = stamp;
    if (persistAndRender(note ? "进度记录已保存" : "进度记录已清空")) {
      dom["progress-dialog"].close();
    }
    dom["progress-save-button"].disabled = false;
  }

  function openLinkManager(taskId) {
    var task = getTask(taskId);
    if (!task) return;
    ui.managedTaskId = taskId;
    ui.managedMaterials = utils.clone(getTaskMaterials(taskId));
    dom["link-dialog-title"].textContent = "管理相关资料";
    dom["link-dialog-task"].textContent =
      task.name + " · 资料按类型分组；修改后会同步到资料库";
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
    dom["material-dialog-title"].textContent = material ? "编辑资料" : "添加资料";
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
    if (!window.confirm("确认删除资料「" + material.title + "」？所有 Task 中的关联也会移除。")) {
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
    var errors = result.errors.slice();
    var seenUploadUrls = new Map();
    resolved.forEach(function (row) {
      row.errors.forEach(function (message) {
        errors.push("第 " + row.sourceRow + " 行：" + message);
      });
      var key = materialUrlKey(row.value.url);
      if (seenUploadUrls.has(key)) {
        errors.push(
          "第 " +
            row.sourceRow +
            " 行：链接地址与第 " +
            seenUploadUrls.get(key) +
            " 行重复"
        );
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
        list.appendChild(utils.el("li", "", message));
      });
      errorBox.appendChild(list);
    }
    var preview = utils.clear(dom["material-import-preview"]);
    resolved.slice(0, 20).forEach(function (row, index) {
      var tableRow = utils.el("tr");
      [
        index + 1,
        row.value.title,
        materialTools.TYPE_LABELS[row.value.type],
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
        !window.confirm(
          "全部覆盖会先删除资料库现有的 " +
            data.materials.length +
            " 条资料，再导入 " +
            pending.rows.length +
            " 条新资料。是否继续？"
        )
      ) {
        return;
      }
      if (!window.confirm("再次确认：全部覆盖不可撤销，建议已先导出 JSON 备份。")) return;
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
    var filename = "Weekflow_资料库_" + dates.dateTimeStamp(new Date()) + ".xlsx";
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
    var errors = result.errors.slice();
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
        list.appendChild(utils.el("li", "", message));
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
        automation.CADENCE_LABELS[row.recurrenceCadence] || "不重复",
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
        progressNote: row.progressNote,
        progressUpdatedAt: row.progressNote ? stamp : null,
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
        progressNote: row.progressNote,
        progressUpdatedAt: row.progressNote
          ? existing &&
            existing.progressNote === row.progressNote &&
            existing.progressUpdatedAt
            ? existing.progressUpdatedAt
            : stamp
          : null,
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
        !window.confirm(
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
        !window.confirm(
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
      "Weekflow_Task当前数据_" + dates.dateTimeStamp(new Date()) + ".xlsx";
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
      label: button.dataset.scopeLabel || ""
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
      var filename = "Task数据备份_" + dates.dateTimeStamp(new Date()) + ".json";
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
          !window.confirm(
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
            "weekflow-v2.3:pre-import-backup",
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
    var node = utils.el("div", "toast" + (type ? " " + type : ""), message);
    dom["toast-region"].appendChild(node);
    window.setTimeout(function () {
      node.remove();
    }, duration || 4000);
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
