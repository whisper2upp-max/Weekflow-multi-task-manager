/* 数据校验、版本化 localStorage 持久化与空白初始数据。 */
(function (root, factory) {
  var deps = {
    dates:
      root.App && root.App.dateUtils
        ? root.App.dateUtils
        : typeof require === "function"
          ? require("./date-utils.js")
          : null,
    utils:
      root.App && root.App.utils
        ? root.App.utils
        : typeof require === "function"
          ? require("./utils.js")
          : null,
    materials:
      root.App && root.App.materials
        ? root.App.materials
        : typeof require === "function"
          ? require("./materials.js")
          : null,
    richText:
      root.App && root.App.richText
        ? root.App.richText
        : typeof require === "function"
          ? require("./rich-text.js")
          : null
  };
  var api = factory(deps.dates, deps.utils, deps.materials, deps.richText);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.storage = api;
})(typeof self !== "undefined" ? self : globalThis, function (dates, utils, materialTools, richText) {
  "use strict";

  var STORAGE_KEY = "weekflow-v2.4:data:v4";
  var LEGACY_STORAGE_KEY = "weekflow-v2.4:data:v3";
  var CORRUPT_KEY = "weekflow-v2.4:corrupt-backup";
  var PREVIOUS_STORAGE_KEYS = [
    "weekflow-v2.4:data:v3",
    "weekflow-v2.4:data:v2",
    "weekflow-v2.4:data:v1",
    "weekflow-v2.3:data:v3",
    "weekflow-v2.3:data:v2",
    "weekflow-v2.3:data:v1",
    "weekflow-v2.2:data:v3",
    "weekflow-v2.2:data:v2",
    "weekflow-v2.2:data:v1",
    "weekflow-v2.1:data:v3",
    "weekflow-v2.1:data:v2",
    "weekflow-v2.1:data:v1",
    "weekflow-v2.0:data:v3",
    "weekflow-v2.0:data:v2",
    "weekflow-v2.0:data:v1",
    "weekflow-v1.1:data:v2",
    "weekflow-v1.1:data:v1",
    "weekflow-v1.0:data:v2",
    "weekflow-v1.0:data:v1"
  ];
  var VERSION = 4;
  var SUPPORTED_VERSIONS = [1, 2, 3, 4];
  var COLORS = ["#665CFF", "#0AA6B5", "#9B5DE5", "#FF7A45", "#2CA77B", "#E94E89", "#7BA23F"];
  var UNGROUPED_MATERIAL_KEY = "__ungrouped__";
  var memoryData = null;
  var lastWarning = "";

  function nowISO() {
    return new Date().toISOString();
  }

  function isValidTimestamp(value) {
    if (value === null || value === undefined || String(value).trim() === "") return false;
    return !Number.isNaN(new Date(value).getTime());
  }

  function safeId(value, prefix) {
    var clean = String(value || "").trim();
    return clean && /^[a-zA-Z0-9_-]+$/.test(clean) ? clean : utils.uid(prefix);
  }

  function normalizeLink(link) {
    return {
      id: safeId(link && link.id, "link"),
      title: String((link && link.title) || "").trim().slice(0, 160),
      url: String((link && link.url) || "").trim().slice(0, 3000)
    };
  }

  function normalizeMaterial(material) {
    return materialTools.normalizeMaterial(material);
  }

  function normalizeGroup(group, index) {
    var created = String((group && group.createdAt) || nowISO());
    return {
      id: safeId(group && group.id, "group"),
      name: String((group && group.name) || "").trim().slice(0, 80),
      color: utils.isHexColor(group && group.color) ? group.color.toUpperCase() : COLORS[index % COLORS.length],
      order: Number.isFinite(Number(group && group.order)) ? Number(group.order) : index + 1,
      collapsed: Boolean(group && group.collapsed),
      createdAt: created,
      updatedAt: String((group && group.updatedAt) || created)
    };
  }

  function normalizeFlow(flow, index) {
    var created = String((flow && flow.createdAt) || nowISO());
    return {
      id: safeId(flow && flow.id, "flow"),
      groupId: String((flow && flow.groupId) || ""),
      name: String((flow && flow.name) || "").trim().slice(0, 80),
      color: utils.isHexColor(flow && flow.color)
        ? flow.color.toUpperCase()
        : COLORS[(index + 2) % COLORS.length],
      order: Number.isFinite(Number(flow && flow.order)) ? Number(flow.order) : index + 1,
      collapsed: Boolean(flow && flow.collapsed),
      createdAt: created,
      updatedAt: String((flow && flow.updatedAt) || created)
    };
  }

  function normalizeDocumentLibraryPreferences(preferences, groups) {
    var source = preferences && typeof preferences === "object" ? preferences : {};
    var sortedGroupIds = (Array.isArray(groups) ? groups : [])
      .slice()
      .sort(function (left, right) {
        return (
          Number(left.order || 0) - Number(right.order || 0) ||
          left.name.localeCompare(right.name, "zh-CN", { numeric: true })
        );
      })
      .map(function (group) {
        return group.id;
      });
    var validKeys = new Set(sortedGroupIds.concat(UNGROUPED_MATERIAL_KEY));
    var seen = new Set();
    var groupOrder = (Array.isArray(source.groupOrder) ? source.groupOrder : [])
      .map(function (value) {
        return String(value || "").trim();
      })
      .filter(function (value) {
        if (!validKeys.has(value) || seen.has(value)) return false;
        seen.add(value);
        return true;
      });
    sortedGroupIds.forEach(function (groupId) {
      if (seen.has(groupId)) return;
      var ungroupedIndex = groupOrder.indexOf(UNGROUPED_MATERIAL_KEY);
      if (ungroupedIndex >= 0) groupOrder.splice(ungroupedIndex, 0, groupId);
      else groupOrder.push(groupId);
      seen.add(groupId);
    });
    if (!seen.has(UNGROUPED_MATERIAL_KEY)) groupOrder.push(UNGROUPED_MATERIAL_KEY);
    var columns = Number(source.columns);
    return {
      layout: source.layout === "group" ? "group" : "list",
      columns: Number.isInteger(columns) && columns >= 1 && columns <= 4 ? columns : 4,
      groupOrder: groupOrder
    };
  }

  function normalizePreferences(preferences, groups) {
    var source = preferences && typeof preferences === "object" ? preferences : {};
    return {
      documentLibrary: normalizeDocumentLibraryPreferences(
        source.documentLibrary,
        groups
      )
    };
  }

  function normalizeRecurrenceCompletion(record) {
    return {
      periodKey: String((record && record.periodKey) || "").trim().slice(0, 20),
      occurrenceDdl: dates.formatDate(record && record.occurrenceDdl),
      completedAt: dates.formatDate(record && record.completedAt)
    };
  }

  function normalizeProgressEntry(entry, fallback) {
    var source = entry && typeof entry === "object" ? entry : {};
    var base = fallback && typeof fallback === "object" ? fallback : {};
    var created = [source.createdAt, base.createdAt, base.updatedAt, nowISO()].find(
      isValidTimestamp
    );
    var updated = [source.updatedAt, created].find(isValidTimestamp);
    var rawHtml = String(source.contentHtml || "");
    var rawText = String(source.contentText || source.content || base.contentText || "");
    var contentHtml = rawHtml
      ? richText.sanitizeHtml(rawHtml, richText.MAX_PROGRESS_TEXT)
      : richText.fromPlainText(rawText.slice(0, richText.MAX_PROGRESS_TEXT));
    var contentText = richText
      .plainText(contentHtml)
      .slice(0, richText.MAX_PROGRESS_TEXT);
    if (!contentText) return null;
    var sourceType = ["manual", "quick-note", "excel-import", "legacy"].includes(
      source.sourceType
    )
      ? source.sourceType
      : base.sourceType || "manual";
    return {
      id: safeId(source.id, "progress"),
      contentHtml: contentHtml,
      contentText: contentText,
      sourceType: sourceType,
      sourceNoteId: source.sourceNoteId ? String(source.sourceNoteId) : null,
      createdAt: String(created),
      updatedAt: String(updated)
    };
  }

  function normalizeProgressEntries(task, created) {
    var source = Array.isArray(task && task.progressEntries)
      ? task.progressEntries
      : [];
    if (!source.length && String((task && task.progressNote) || "").trim()) {
      source = [
        {
          contentText: String(task.progressNote),
          sourceType: "legacy",
          createdAt: task.progressUpdatedAt || task.updatedAt || created,
          updatedAt: task.progressUpdatedAt || task.updatedAt || created
        }
      ];
    }
    return source
      .map(function (entry) {
        return normalizeProgressEntry(entry, {
          createdAt: created,
          updatedAt: task && task.updatedAt,
          sourceType: "manual"
        });
      })
      .filter(Boolean);
  }

  function normalizeConversion(conversion) {
    var source = conversion && typeof conversion === "object" ? conversion : {};
    var type = source.type === "task" ? "task" : "progress";
    var created = isValidTimestamp(source.createdAt) ? String(source.createdAt) : nowISO();
    function uniqueIds(values) {
      var seen = new Set();
      return (Array.isArray(values) ? values : [])
        .map(function (value) {
          return String(value || "").trim();
        })
        .filter(function (value) {
          if (!value || seen.has(value)) return false;
          seen.add(value);
          return true;
        });
    }
    return {
      id: safeId(source.id, "conversion"),
      type: type,
      taskIds: uniqueIds(source.taskIds),
      progressEntryIds: uniqueIds(source.progressEntryIds),
      skippedCount: Math.max(0, Number(source.skippedCount) || 0),
      createdAt: created
    };
  }

  function normalizeNote(note) {
    var source = note && typeof note === "object" ? note : {};
    var created = isValidTimestamp(source.createdAt) ? String(source.createdAt) : nowISO();
    var updated = isValidTimestamp(source.updatedAt) ? String(source.updatedAt) : created;
    var rawHtml = String(source.contentHtml || "");
    var rawText = String(source.contentText || source.content || "");
    var contentHtml = rawHtml
      ? richText.sanitizeHtml(rawHtml, richText.MAX_NOTE_TEXT)
      : richText.fromPlainText(rawText.slice(0, richText.MAX_NOTE_TEXT));
    return {
      id: safeId(source.id, "note"),
      title: String(source.title || "").trim().slice(0, 160),
      contentHtml: contentHtml,
      contentText: richText.plainText(contentHtml).slice(0, richText.MAX_NOTE_TEXT),
      favorite: Boolean(source.favorite),
      conversions: (Array.isArray(source.conversions) ? source.conversions : []).map(
        normalizeConversion
      ),
      createdAt: created,
      updatedAt: updated
    };
  }

  function normalizeTask(task) {
    var created = String((task && task.createdAt) || nowISO());
    var status = task && task.status === "completed" ? "completed" : "pending";
    var progressEntries = normalizeProgressEntries(task, created);
    var latestProgress = richText.latestProgressEntry({ progressEntries: progressEntries });
    var progressNote = latestProgress ? latestProgress.contentText : "";
    var progressTimestamp = latestProgress ? latestProgress.updatedAt : null;
    var urgency = ["high", "medium", "low"].includes(task && task.urgency)
      ? task.urgency
      : "medium";
    var rawFlowOrder = Number(task && task.flowOrder);
    var recurrenceCadence = ["weekly", "monthly"].includes(
      task && task.recurrenceCadence
    )
      ? task.recurrenceCadence
      : "none";
    return {
      id: safeId(task && task.id, "task"),
      groupId: String((task && task.groupId) || ""),
      flowId: task && task.flowId ? String(task.flowId) : null,
      flowOrder: Number.isFinite(rawFlowOrder) && rawFlowOrder >= 1 ? rawFlowOrder : null,
      name: String((task && task.name) || "").trim().slice(0, 160),
      reportTo: String((task && task.reportTo) || "").trim().slice(0, 120),
      managedObject: String((task && task.managedObject) || "").trim().slice(0, 160),
      deliverable: String((task && task.deliverable) || "").trim().slice(0, 500),
      ddl: dates.formatDate(task && task.ddl),
      urgency: urgency,
      status: status,
      completedAt:
        status === "completed"
          ? dates.formatDate((task && task.completedAt) || dates.todayISO())
          : null,
      progressNote: progressNote,
      progressUpdatedAt: progressTimestamp,
      progressEntries: progressEntries,
      recurrenceCadence: recurrenceCadence,
      recurrenceStart:
        recurrenceCadence === "none" ? null : dates.formatDate(task && task.recurrenceStart),
      recurrenceEnd:
        recurrenceCadence === "none" ? null : dates.formatDate(task && task.recurrenceEnd),
      recurrenceCompletions:
        recurrenceCadence !== "none" && Array.isArray(task && task.recurrenceCompletions)
          ? task.recurrenceCompletions.map(normalizeRecurrenceCompletion)
          : [],
      documentLinks: Array.isArray(task && task.documentLinks)
        ? task.documentLinks.map(normalizeLink)
        : [],
      deliverableLinks: Array.isArray(task && task.deliverableLinks)
        ? task.deliverableLinks.map(normalizeLink)
        : [],
      createdAt: created,
      updatedAt: String((task && task.updatedAt) || created)
    };
  }

  function validateData(input) {
    var errors = [];
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return { valid: false, errors: ["备份根节点必须是对象。"], data: null };
    }
    var inputVersion = Number(input.version);
    if (!Number.isInteger(inputVersion) || !SUPPORTED_VERSIONS.includes(inputVersion)) {
      errors.push(
        "不支持的数据版本：" + String(input.version === undefined ? "缺失" : input.version) + "。"
      );
    }
    if (!Array.isArray(input.groups)) errors.push("groups 必须是数组。");
    if (!Array.isArray(input.tasks)) errors.push("tasks 必须是数组。");
    if (inputVersion >= 2 && !Array.isArray(input.flows)) {
      errors.push("flows 必须是数组。");
    }
    if (inputVersion >= 3 && !Array.isArray(input.materials)) {
      errors.push("materials 必须是数组。");
    }
    if (inputVersion === VERSION && !Array.isArray(input.notes)) {
      errors.push("notes 必须是数组。");
    }
    if (errors.length) return { valid: false, errors: errors, data: null };

    var groups = input.groups.map(normalizeGroup);
    var groupIds = new Set();
    groups.forEach(function (group, index) {
      if (!group.name) errors.push("第 " + (index + 1) + " 个分组缺少名称。");
      if (groupIds.has(group.id)) errors.push("分组 ID 重复：" + group.id);
      groupIds.add(group.id);
    });

    var flows = (Array.isArray(input.flows) ? input.flows : []).map(normalizeFlow);
    var flowIds = new Set();
    var flowNamesByGroup = new Set();
    flows.forEach(function (flow, index) {
      if (!flow.name) errors.push("第 " + (index + 1) + " 个 Flow 缺少名称。");
      if (!groupIds.has(flow.groupId)) {
        errors.push("Flow「" + (flow.name || index + 1) + "」所属分组不存在。");
      }
      if (flowIds.has(flow.id)) errors.push("Flow ID 重复：" + flow.id);
      flowIds.add(flow.id);
      var nameKey = flow.groupId + "::" + flow.name.toLocaleLowerCase();
      if (flowNamesByGroup.has(nameKey)) {
        errors.push("同一分组中存在同名 Flow：" + flow.name);
      }
      flowNamesByGroup.add(nameKey);
    });
    var flowMap = new Map(
      flows.map(function (flow) {
        return [flow.id, flow];
      })
    );

    var taskIds = new Set();
    var tasks = input.tasks.map(normalizeTask);
    tasks.forEach(function (task, index) {
      if (!task.name) errors.push("第 " + (index + 1) + " 个 Task 缺少名称。");
      if (!task.ddl) errors.push("Task「" + (task.name || index + 1) + "」的 DDL 无效。");
      if (!groupIds.has(task.groupId)) {
        errors.push("Task「" + (task.name || index + 1) + "」所属分组不存在。");
      }
      if (taskIds.has(task.id)) errors.push("Task ID 重复：" + task.id);
      taskIds.add(task.id);
      if (task.flowId) {
        var flow = flowMap.get(task.flowId);
        if (!flow) {
          errors.push("Task「" + (task.name || index + 1) + "」所属 Flow 不存在。");
        } else if (flow.groupId !== task.groupId) {
          errors.push("Task「" + (task.name || index + 1) + "」的 Flow 与分组不一致。");
        }
      }
      var rawTask = input.tasks[index] || {};
      var rawCadence = String(rawTask.recurrenceCadence || "none");
      if (!["none", "weekly", "monthly"].includes(rawCadence)) {
        errors.push("Task「" + (task.name || index + 1) + "」的周期类型无效。");
      }
      if (task.recurrenceCadence !== "none") {
        if (!task.recurrenceStart || !task.recurrenceEnd) {
          errors.push("Task「" + (task.name || index + 1) + "」缺少周期开始或结束日期。");
        } else if (task.recurrenceStart > task.recurrenceEnd) {
          errors.push("Task「" + (task.name || index + 1) + "」的周期开始日期晚于结束日期。");
        } else if (task.ddl < task.recurrenceStart || task.ddl > task.recurrenceEnd) {
          errors.push("Task「" + (task.name || index + 1) + "」的 DDL 必须位于周期起止日期内。");
        } else if (!dates.getRecurringOccurrences(task).length) {
          errors.push("Task「" + (task.name || index + 1) + "」在周期范围内没有可用 DDL。");
        }
        if (
          rawTask.recurrenceCompletions !== undefined &&
          !Array.isArray(rawTask.recurrenceCompletions)
        ) {
          errors.push("Task「" + (task.name || index + 1) + "」的周期完成记录必须是数组。");
        }
        var validOccurrenceKeys = new Set(
          dates.getRecurringOccurrences(task).map(function (occurrence) {
            return occurrence.periodKey;
          })
        );
        var seenCompletionKeys = new Set();
        task.recurrenceCompletions.forEach(function (record) {
          if (
            !record.periodKey ||
            !record.occurrenceDdl ||
            !record.completedAt ||
            !validOccurrenceKeys.has(record.periodKey)
          ) {
            errors.push("Task「" + (task.name || index + 1) + "」包含无效周期完成记录。");
          }
          if (seenCompletionKeys.has(record.periodKey)) {
            errors.push("Task「" + (task.name || index + 1) + "」包含重复周期完成记录。");
          }
          seenCompletionKeys.add(record.periodKey);
        });
      }
      if (
        task.progressNote &&
        rawTask.progressUpdatedAt !== undefined &&
        rawTask.progressUpdatedAt !== null &&
        String(rawTask.progressUpdatedAt).trim() &&
        !isValidTimestamp(rawTask.progressUpdatedAt)
      ) {
        errors.push("Task「" + (task.name || index + 1) + "」的进度更新时间无效。");
      }
      if (Array.isArray(rawTask.progressEntries)) {
        rawTask.progressEntries.forEach(function (entry, entryIndex) {
          ["createdAt", "updatedAt"].forEach(function (field) {
            if (
              entry &&
              entry[field] !== undefined &&
              entry[field] !== null &&
              String(entry[field]).trim() &&
              !isValidTimestamp(entry[field])
            ) {
              errors.push(
                "Task「" +
                  (task.name || index + 1) +
                  "」第 " +
                  (entryIndex + 1) +
                  " 条进度记录的时间无效。"
              );
            }
          });
        });
      }
      if (inputVersion < VERSION) {
        task.documentLinks.concat(task.deliverableLinks).forEach(function (link) {
          if (!link.title || !utils.isValidUrl(link.url)) {
            errors.push("Task「" + (task.name || index + 1) + "」包含无效链接。");
          }
        });
      }
    });

    flows.forEach(function (flow) {
      tasks
        .map(function (task, sourceIndex) {
          return { task: task, sourceIndex: sourceIndex };
        })
        .filter(function (item) {
          return item.task.flowId === flow.id;
        })
        .sort(function (left, right) {
          var leftOrder = left.task.flowOrder === null ? Number.MAX_SAFE_INTEGER : left.task.flowOrder;
          var rightOrder =
            right.task.flowOrder === null ? Number.MAX_SAFE_INTEGER : right.task.flowOrder;
          return leftOrder - rightOrder || left.sourceIndex - right.sourceIndex;
        })
        .forEach(function (item, index) {
          item.task.flowOrder = index + 1;
        });
    });
    tasks.forEach(function (task) {
      if (!task.flowId) task.flowOrder = null;
    });

    var sourceMaterials =
      inputVersion >= 3
        ? input.materials
        : materialTools.migrateLegacyLinks(tasks, String(input.updatedAt || nowISO()));
    var materialIds = new Set();
    var materials = sourceMaterials.map(normalizeMaterial);
    materials.forEach(function (material, index) {
      var rawMaterial = sourceMaterials[index] || {};
      if (!material.title) errors.push("第 " + (index + 1) + " 条资料缺少链接名称。");
      if (!utils.isValidUrl(material.url)) {
        errors.push("资料「" + (material.title || index + 1) + "」的链接地址无效。");
      }
      if (!materialTools.normalizeType(rawMaterial.type)) {
        errors.push("资料「" + (material.title || index + 1) + "」的类型无效。");
      }
      if (materialIds.has(material.id)) errors.push("资料 ID 重复：" + material.id);
      materialIds.add(material.id);
      material.taskIds.forEach(function (id) {
        if (!taskIds.has(id)) {
          errors.push("资料「" + (material.title || index + 1) + "」关联的 Task 不存在。");
        }
      });
      material.flowIds.forEach(function (id) {
        if (!flowIds.has(id)) {
          errors.push("资料「" + (material.title || index + 1) + "」关联的 Flow 不存在。");
        }
      });
      material.groupIds.forEach(function (id) {
        if (!groupIds.has(id)) {
          errors.push("资料「" + (material.title || index + 1) + "」关联的分组不存在。");
        }
      });
      (Array.isArray(rawMaterial.openEvents) ? rawMaterial.openEvents : []).forEach(
        function (value) {
          if (!isValidTimestamp(value)) {
            errors.push("资料「" + (material.title || index + 1) + "」包含无效打开时间。");
          }
        }
      );
    });
    tasks.forEach(function (task) {
      delete task.documentLinks;
      delete task.deliverableLinks;
    });

    var noteIds = new Set();
    var notes = (Array.isArray(input.notes) ? input.notes : []).map(normalizeNote);
    notes.forEach(function (note, index) {
      if (!note.title) errors.push("第 " + (index + 1) + " 条随手记缺少标题。");
      if (noteIds.has(note.id)) errors.push("随手记 ID 重复：" + note.id);
      noteIds.add(note.id);
      var rawNote = (input.notes || [])[index] || {};
      ["createdAt", "updatedAt"].forEach(function (field) {
        if (
          rawNote[field] !== undefined &&
          rawNote[field] !== null &&
          String(rawNote[field]).trim() &&
          !isValidTimestamp(rawNote[field])
        ) {
          errors.push("随手记「" + (note.title || index + 1) + "」的时间无效。");
        }
      });
    });

    var data = {
      version: VERSION,
      groups: groups,
      flows: flows,
      tasks: tasks,
      materials: materials,
      notes: notes,
      preferences: normalizePreferences(input.preferences, groups),
      updatedAt: String(input.updatedAt || nowISO())
    };
    return { valid: errors.length === 0, errors: errors, data: data };
  }

  function makeEmptyData() {
    var stamp = nowISO();
    return {
      version: VERSION,
      groups: [],
      flows: [],
      tasks: [],
      materials: [],
      notes: [],
      preferences: normalizePreferences(null, []),
      updatedAt: stamp
    };
  }

  function persist(data) {
    var checked = validateData(data);
    if (!checked.valid) throw new Error(checked.errors.join("\n"));
    checked.data.updatedAt = nowISO();
    memoryData = utils.clone(checked.data);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(checked.data));
      }
    } catch (_error) {
      lastWarning = "浏览器阻止了本地存储，本次修改仅在当前页面有效。";
    }
    return utils.clone(checked.data);
  }

  function load() {
    lastWarning = "";
    if (typeof localStorage === "undefined") {
      memoryData = memoryData || makeEmptyData();
      lastWarning = "当前环境不支持 localStorage，数据仅在本次页面中保留。";
      return utils.clone(memoryData);
    }
    var raw = null;
    var loadedFromLegacy = "";
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        PREVIOUS_STORAGE_KEYS.some(function (key) {
          raw = localStorage.getItem(key);
          if (raw) loadedFromLegacy = key;
          return Boolean(raw);
        });
      }
      if (!raw) return persist(makeEmptyData());
      var checked = validateData(JSON.parse(raw));
      if (!checked.valid) throw new Error(checked.errors.join("\n"));
      if (loadedFromLegacy) {
        var migrated = persist(checked.data);
        lastWarning = "已自动迁移旧版 Weekflow 数据，并将原进度记录转换为可继续追加的进度历史。";
        return migrated;
      }
      memoryData = checked.data;
      return utils.clone(checked.data);
    } catch (error) {
      try {
        if (raw) localStorage.setItem(CORRUPT_KEY, raw);
      } catch (_backupError) {
        /* 无法写入损坏数据备份时仍要保证应用可启动。 */
      }
      lastWarning =
        "检测到无法读取的数据，原始内容已尝试保存在 corrupt-backup，现已载入空白数据。";
      var fallback = makeEmptyData();
      try {
        persist(fallback);
      } catch (_persistError) {
        memoryData = fallback;
      }
      return utils.clone(fallback);
    }
  }

  function getLastWarning() {
    return lastWarning;
  }

  function nextGroupColor(groups) {
    var used = new Set(
      (Array.isArray(groups) ? groups : []).map(function (group) {
        return String(group.color || "").toUpperCase();
      })
    );
    return (
      COLORS.find(function (color) {
        return !used.has(color);
      }) || COLORS[(Array.isArray(groups) ? groups.length : 0) % COLORS.length]
    );
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    LEGACY_STORAGE_KEY: LEGACY_STORAGE_KEY,
    CORRUPT_KEY: CORRUPT_KEY,
    PREVIOUS_STORAGE_KEYS: PREVIOUS_STORAGE_KEYS.slice(),
    VERSION: VERSION,
    COLORS: COLORS.slice(),
    load: load,
    save: persist,
    validateData: validateData,
    makeEmptyData: makeEmptyData,
    normalizePreferences: normalizePreferences,
    normalizeProgressEntry: normalizeProgressEntry,
    normalizeNote: normalizeNote,
    nextGroupColor: nextGroupColor,
    getLastWarning: getLastWarning
  };
});
