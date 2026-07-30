/* Weekflow 资料实体、关联解析与自然周常用统计。 */
(function (root, factory) {
  var utils =
    root.App && root.App.utils
      ? root.App.utils
      : typeof require === "function"
        ? require("./utils.js")
        : null;
  var api = factory(utils);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.materials = api;
})(typeof self !== "undefined" ? self : globalThis, function (utils) {
  "use strict";

  var TYPES = ["document", "deliverable", "control", "folder"];
  var TYPE_LABELS = {
    document: "说明文档",
    deliverable: "交付物",
    control: "控制表",
    folder: "文件夹"
  };
  var TYPE_ALIASES = {
    document: "document",
    doc: "document",
    "说明文档": "document",
    "文档": "document",
    deliverable: "deliverable",
    delivery: "deliverable",
    "交付物": "deliverable",
    control: "control",
    "控制表": "control",
    "控制": "control",
    folder: "folder",
    "文件夹": "folder",
    "目录": "folder"
  };

  function cleanText(value, maxLength) {
    return String(value === null || value === undefined ? "" : value)
      .trim()
      .slice(0, maxLength || 500);
  }

  function safeId(value, prefix) {
    var clean = cleanText(value, 180);
    return clean && /^[a-zA-Z0-9_-]+$/.test(clean) ? clean : utils.uid(prefix);
  }

  function normalizeType(value) {
    var key = cleanText(value, 40).toLocaleLowerCase();
    return TYPE_ALIASES[key] || "";
  }

  function uniqueIds(values) {
    var seen = new Set();
    return (Array.isArray(values) ? values : [])
      .map(function (value) {
        return cleanText(value, 180);
      })
      .filter(function (value) {
        if (!value || seen.has(value)) return false;
        seen.add(value);
        return true;
      });
  }

  function normalizeOpenEvents(values) {
    return (Array.isArray(values) ? values : [])
      .map(function (value) {
        return cleanText(value, 80);
      })
      .filter(function (value) {
        return value && !Number.isNaN(new Date(value).getTime());
      })
      .sort()
      .slice(-500);
  }

  function normalizeMaterial(material) {
    var created = cleanText(material && material.createdAt, 80) || new Date().toISOString();
    return {
      id: safeId(material && material.id, "material"),
      title: cleanText(material && material.title, 160),
      url: cleanText(material && material.url, 3000),
      type: normalizeType(material && material.type) || "document",
      taskIds: uniqueIds(material && material.taskIds),
      flowIds: uniqueIds(material && material.flowIds),
      groupIds: uniqueIds(material && material.groupIds),
      note: cleanText(material && material.note, 2000),
      openEvents: normalizeOpenEvents(material && material.openEvents),
      createdAt: created,
      updatedAt: cleanText(material && material.updatedAt, 80) || created
    };
  }

  function makeMaterial(details, stamp) {
    var now = stamp || new Date().toISOString();
    return normalizeMaterial(
      Object.assign(
        {
          id: utils.uid("material"),
          type: "document",
          taskIds: [],
          flowIds: [],
          groupIds: [],
          note: "",
          openEvents: [],
          createdAt: now,
          updatedAt: now
        },
        details || {}
      )
    );
  }

  function migrateLegacyLinks(tasks, stamp) {
    var materialByKey = new Map();
    (Array.isArray(tasks) ? tasks : []).forEach(function (task) {
      [
        ["document", task.documentLinks],
        ["deliverable", task.deliverableLinks]
      ].forEach(function (source) {
        (Array.isArray(source[1]) ? source[1] : []).forEach(function (link) {
          var title = cleanText(link && link.title, 160);
          var url = cleanText(link && link.url, 3000);
          var key = source[0] + "::" + title.toLocaleLowerCase() + "::" + url;
          var material = materialByKey.get(key);
          if (!material) {
            material = makeMaterial(
              {
                id: link && link.id,
                title: title,
                url: url,
                type: source[0],
                taskIds: [],
                flowIds: [],
                groupIds: []
              },
              stamp
            );
            materialByKey.set(key, material);
          }
          material.taskIds = uniqueIds(material.taskIds.concat(task.id || []));
        });
      });
    });
    return Array.from(materialByKey.values());
  }

  function byId(items) {
    return new Map(
      (Array.isArray(items) ? items : []).map(function (item) {
        return [item.id, item];
      })
    );
  }

  function resolveRelations(material, data) {
    var taskMap = byId(data && data.tasks);
    var flowMap = byId(data && data.flows);
    var groupMap = byId(data && data.groups);
    var taskIds = uniqueIds(material && material.taskIds).filter(function (id) {
      return taskMap.has(id);
    });
    var flowIds = uniqueIds(material && material.flowIds).filter(function (id) {
      return flowMap.has(id);
    });
    var groupIds = uniqueIds(material && material.groupIds).filter(function (id) {
      return groupMap.has(id);
    });

    taskIds.forEach(function (taskId) {
      var task = taskMap.get(taskId);
      if (task.flowId && flowMap.has(task.flowId) && !flowIds.includes(task.flowId)) {
        flowIds.push(task.flowId);
      }
      if (task.groupId && groupMap.has(task.groupId) && !groupIds.includes(task.groupId)) {
        groupIds.push(task.groupId);
      }
    });
    flowIds.forEach(function (flowId) {
      var flow = flowMap.get(flowId);
      if (flow && groupMap.has(flow.groupId) && !groupIds.includes(flow.groupId)) {
        groupIds.push(flow.groupId);
      }
    });
    return {
      taskIds: taskIds,
      flowIds: flowIds,
      groupIds: groupIds,
      tasks: taskIds.map(function (id) {
        return taskMap.get(id);
      }),
      flows: flowIds.map(function (id) {
        return flowMap.get(id);
      }),
      groups: groupIds.map(function (id) {
        return groupMap.get(id);
      })
    };
  }

  function forTask(materials, taskId) {
    return (Array.isArray(materials) ? materials : []).filter(function (material) {
      return Array.isArray(material.taskIds) && material.taskIds.includes(taskId);
    });
  }

  function startOfNaturalWeek(value) {
    var date = value instanceof Date ? new Date(value.getTime()) : new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) date = new Date();
    date.setHours(0, 0, 0, 0);
    var day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return date;
  }

  function currentAndPreviousWeekOpenCount(material, now) {
    var current = now instanceof Date ? new Date(now.getTime()) : new Date(now || Date.now());
    if (Number.isNaN(current.getTime())) current = new Date();
    var start = startOfNaturalWeek(current);
    start.setDate(start.getDate() - 7);
    var startTime = start.getTime();
    var endTime = current.getTime();
    return (Array.isArray(material && material.openEvents) ? material.openEvents : []).filter(
      function (value) {
        var time = new Date(value).getTime();
        return !Number.isNaN(time) && time >= startTime && time <= endTime;
      }
    ).length;
  }

  function openedInCurrentOrPreviousWeek(material, now) {
    return currentAndPreviousWeekOpenCount(material, now) > 0;
  }

  /* 保留旧方法名，避免外部脚本失效；统计口径已切换为本周与上周。 */
  function recentOpenCount(material, now) {
    return currentAndPreviousWeekOpenCount(material, now);
  }

  function recordOpen(material, now) {
    var time = now instanceof Date ? now : new Date(now || Date.now());
    var cutoff = time.getTime() - 90 * 24 * 60 * 60 * 1000;
    material.openEvents = normalizeOpenEvents(
      (Array.isArray(material.openEvents) ? material.openEvents : [])
        .filter(function (value) {
          var parsed = new Date(value).getTime();
          return !Number.isNaN(parsed) && parsed >= cutoff;
        })
        .concat(time.toISOString())
    );
    material.updatedAt = time.toISOString();
    return material;
  }

  function firstGroupSortKey(material, data) {
    var relations = resolveRelations(material, data);
    if (!relations.groups.length) return [Number.MAX_SAFE_INTEGER, "未分组"];
    var sorted = relations.groups.slice().sort(function (left, right) {
      return (
        Number(left.order || 0) - Number(right.order || 0) ||
        left.name.localeCompare(right.name, "zh-CN", { numeric: true })
      );
    });
    return [Number(sorted[0].order || 0), sorted[0].name];
  }

  function sortByGroup(materials, data) {
    return (Array.isArray(materials) ? materials : []).slice().sort(function (left, right) {
      var leftKey = firstGroupSortKey(left, data);
      var rightKey = firstGroupSortKey(right, data);
      return (
        leftKey[0] - rightKey[0] ||
        leftKey[1].localeCompare(rightKey[1], "zh-CN", { numeric: true }) ||
        left.title.localeCompare(right.title, "zh-CN", { numeric: true })
      );
    });
  }

  return {
    TYPES: TYPES.slice(),
    TYPE_LABELS: Object.assign({}, TYPE_LABELS),
    cleanText: cleanText,
    normalizeType: normalizeType,
    uniqueIds: uniqueIds,
    normalizeMaterial: normalizeMaterial,
    makeMaterial: makeMaterial,
    migrateLegacyLinks: migrateLegacyLinks,
    resolveRelations: resolveRelations,
    forTask: forTask,
    startOfNaturalWeek: startOfNaturalWeek,
    currentAndPreviousWeekOpenCount: currentAndPreviousWeekOpenCount,
    openedInCurrentOrPreviousWeek: openedInCurrentOrPreviousWeek,
    recentOpenCount: recentOpenCount,
    recordOpen: recordOpen,
    sortByGroup: sortByGroup
  };
});
