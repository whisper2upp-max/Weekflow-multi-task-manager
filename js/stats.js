/* 筛选、排序与统计的纯函数。 */
(function (root, factory) {
  var dates =
    root.App && root.App.dateUtils
      ? root.App.dateUtils
      : typeof require === "function"
        ? require("./date-utils.js")
        : null;
  var api = factory(dates);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.stats = api;
})(typeof self !== "undefined" ? self : globalThis, function (dates) {
  "use strict";

  function normalized(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase()
      .replace(/\s+/g, " ");
  }

  function filterTasks(tasks, filters, today, flows) {
    var source = Array.isArray(tasks) ? tasks : [];
    var active = filters || {};
    var query = normalized(active.search);
    var groupIds = Array.isArray(active.groupIds) ? active.groupIds : [];
    var flowId = active.flowId || "all";
    var flowMap = new Map(
      (Array.isArray(flows) ? flows : []).map(function (flow) {
        return [flow.id, flow];
      })
    );

    return source.filter(function (task) {
      if (groupIds.length && !groupIds.includes(task.groupId)) return false;
      if (flowId === "none" && task.flowId) return false;
      if (flowId !== "all" && flowId !== "none" && task.flowId !== flowId) return false;
      if (active.status && active.status !== "all" && task.status !== active.status) return false;
      if (active.urgency && active.urgency !== "all" && task.urgency !== active.urgency) return false;
      if (active.overdueOnly && !dates.isOverdue(task, today)) return false;
      if (query) {
        var haystack = [
          task.name,
          task.reportTo,
          task.managedObject,
          task.deliverable,
          task.progressNote,
          task.flowId && flowMap.get(task.flowId) ? flowMap.get(task.flowId).name : ""
        ]
          .map(normalized)
          .join(" ");
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  function sortTasks(tasks, today) {
    return (Array.isArray(tasks) ? tasks.slice() : []).sort(function (left, right) {
      var leftCompleted = left.status === "completed" ? 1 : 0;
      var rightCompleted = right.status === "completed" ? 1 : 0;
      if (leftCompleted !== rightCompleted) return leftCompleted - rightCompleted;

      var leftOverdue = dates.isOverdue(left, today) ? 0 : 1;
      var rightOverdue = dates.isOverdue(right, today) ? 0 : 1;
      if (leftOverdue !== rightOverdue) return leftOverdue - rightOverdue;

      if (left.ddl !== right.ddl) return String(left.ddl).localeCompare(String(right.ddl));
      return String(left.name).localeCompare(String(right.name), "zh-CN");
    });
  }

  function sortFlowTasks(tasks, today) {
    return (Array.isArray(tasks) ? tasks.slice() : []).sort(function (left, right) {
      var leftOrder = Number.isFinite(Number(left.flowOrder))
        ? Number(left.flowOrder)
        : Number.MAX_SAFE_INTEGER;
      var rightOrder = Number.isFinite(Number(right.flowOrder))
        ? Number(right.flowOrder)
        : Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      if (left.ddl !== right.ddl) return String(left.ddl).localeCompare(String(right.ddl));
      var nameDifference = String(left.name).localeCompare(String(right.name), "zh-CN");
      return nameDifference || String(left.id || "").localeCompare(String(right.id || ""));
    });
  }

  function summarize(tasks, today) {
    var source = Array.isArray(tasks) ? tasks : [];
    var completed = source.filter(function (task) {
      return task.status === "completed";
    }).length;
    var overdue = source.filter(function (task) {
      return dates.isOverdue(task, today);
    }).length;
    return {
      total: source.length,
      completed: completed,
      pending: source.length - completed,
      overdue: overdue,
      completionRate: dates.completionRate(completed, source.length)
    };
  }

  function summarizeByGroup(groups, tasks, today) {
    var sourceGroups = Array.isArray(groups) ? groups : [];
    var sourceTasks = Array.isArray(tasks) ? tasks : [];
    return sourceGroups
      .slice()
      .sort(function (a, b) {
        return Number(a.order || 0) - Number(b.order || 0);
      })
      .map(function (group) {
        var result = summarize(
          sourceTasks.filter(function (task) {
            return task.groupId === group.id;
          }),
          today
        );
        return Object.assign({ group: group }, result);
      });
  }

  function summarizeByFlow(flows, groups, tasks, today) {
    var sourceFlows = Array.isArray(flows) ? flows : [];
    var sourceGroups = Array.isArray(groups) ? groups : [];
    var sourceTasks = Array.isArray(tasks) ? tasks : [];
    var groupMap = new Map(
      sourceGroups.map(function (group) {
        return [group.id, group];
      })
    );
    var groupOrder = new Map(
      sourceGroups.map(function (group) {
        return [group.id, Number(group.order || 0)];
      })
    );
    return sourceFlows
      .slice()
      .sort(function (left, right) {
        var groupDifference =
          (groupOrder.get(left.groupId) || 0) - (groupOrder.get(right.groupId) || 0);
        if (groupDifference) return groupDifference;
        return Number(left.order || 0) - Number(right.order || 0);
      })
      .map(function (flow) {
        var result = summarize(
          sourceTasks.filter(function (task) {
            return task.flowId === flow.id;
          }),
          today
        );
        return Object.assign(
          {
            flow: flow,
            group: groupMap.get(flow.groupId) || null
          },
          result
        );
      });
  }

  return {
    filterTasks: filterTasks,
    sortTasks: sortTasks,
    sortFlowTasks: sortFlowTasks,
    summarize: summarize,
    summarizeByGroup: summarizeByGroup,
    summarizeByFlow: summarizeByFlow
  };
});
