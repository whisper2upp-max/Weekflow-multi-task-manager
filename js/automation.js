/* 周期 Task 当前周期状态与临期提醒逻辑。 */
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
  root.App.automation = api;
})(typeof self !== "undefined" ? self : globalThis, function (dates) {
  "use strict";

  var CADENCES = ["weekly", "monthly"];
  var CADENCE_LABELS = { weekly: "每周", monthly: "每月" };

  function isCadence(value) {
    return CADENCES.includes(String(value || ""));
  }

  function normalizeCompletions(task) {
    var occurrences = dates.getRecurringOccurrences(task);
    var occurrenceMap = new Map(
      occurrences.map(function (occurrence) {
        return [occurrence.periodKey, occurrence];
      })
    );
    var seen = new Set();
    var normalized = (Array.isArray(task.recurrenceCompletions) ? task.recurrenceCompletions : [])
      .map(function (record) {
        var periodKey = String((record && record.periodKey) || "");
        var occurrence = occurrenceMap.get(periodKey);
        if (!occurrence || seen.has(periodKey)) return null;
        seen.add(periodKey);
        return {
          periodKey: periodKey,
          occurrenceDdl: occurrence.ddl,
          completedAt: dates.formatDate(record && record.completedAt) || occurrence.ddl
        };
      })
      .filter(Boolean)
      .sort(function (left, right) {
        return left.occurrenceDdl.localeCompare(right.occurrenceDdl);
      });
    if (!normalized.length) return normalized;

    // 周期完成记录必须是从第一期开始的连续前缀：确认较晚一期完成，
    // 即表示此前各期均已完成。这里同时修复旧版本留下的间断记录。
    var latest = normalized[normalized.length - 1];
    var latestIndex = occurrences.findIndex(function (occurrence) {
      return occurrence.periodKey === latest.periodKey;
    });
    var recordMap = new Map(
      normalized.map(function (record) {
        return [record.periodKey, record];
      })
    );
    return occurrences.slice(0, latestIndex + 1).map(function (occurrence) {
      return (
        recordMap.get(occurrence.periodKey) || {
          periodKey: occurrence.periodKey,
          occurrenceDdl: occurrence.ddl,
          completedAt: latest.completedAt || occurrence.ddl
        }
      );
    });
  }

  function syncRecurringTaskStates(data, now) {
    var changed = false;
    (data.tasks || []).forEach(function (task) {
      if (!dates.isRecurringTask(task)) return;
      var normalized = normalizeCompletions(task);
      if (JSON.stringify(normalized) !== JSON.stringify(task.recurrenceCompletions || [])) {
        task.recurrenceCompletions = normalized;
        changed = true;
      }
      var state = dates.getTaskPeriodState(task, now);
      var nextStatus = state.completed ? "completed" : "pending";
      var nextCompletedAt = state.completedAt || null;
      if (task.status !== nextStatus || task.completedAt !== nextCompletedAt) {
        task.status = nextStatus;
        task.completedAt = nextCompletedAt;
        changed = true;
      }
    });
    return { changed: changed };
  }

  function setCurrentPeriodCompleted(task, completed, now) {
    var state = dates.getTaskPeriodState(task, now);
    if (!state.recurring || !state.checkboxEnabled || !state.currentOccurrence) {
      return { changed: false, state: state };
    }
    var currentKey = state.currentOccurrence.periodKey;
    var records = normalizeCompletions(task).filter(function (record) {
      return completed
        ? record.periodKey !== currentKey
        : record.occurrenceDdl < state.currentOccurrence.ddl;
    });
    if (completed) {
      records.push({
        periodKey: currentKey,
        occurrenceDdl: state.currentOccurrence.ddl,
        completedAt: dates.todayISO(now instanceof Date ? now : new Date())
      });
    }
    task.recurrenceCompletions = completed
      ? normalizeCompletions(
          Object.assign({}, task, { recurrenceCompletions: records })
        )
      : records;
    var nextState = dates.getTaskPeriodState(task, now);
    task.status = nextState.completed ? "completed" : "pending";
    task.completedAt = nextState.completedAt || null;
    return { changed: true, state: nextState };
  }

  function getDueSoonTasks(data, now, days) {
    var currentDate = dates.todayISO(now instanceof Date ? now : new Date());
    var end = dates.addDays(currentDate, Number.isFinite(Number(days)) ? Number(days) : 7);
    return (data.tasks || [])
      .map(function (task) {
        if (!dates.isRecurringTask(task)) {
          var ddl = dates.formatDate(task.ddl);
          return task.status !== "completed" && ddl && ddl >= currentDate && ddl <= end
            ? { task: task, ddl: ddl }
            : null;
        }
        var occurrence = dates
          .getRecurringOccurrences(task)
          .find(function (item) {
            return (
              item.ddl >= currentDate &&
              item.ddl <= end &&
              !dates.getRecurringCompletion(task, item)
            );
          });
        return occurrence ? { task: task, ddl: occurrence.ddl } : null;
      })
      .filter(Boolean)
      .sort(function (left, right) {
        return (
          left.ddl.localeCompare(right.ddl) ||
          String(left.task.name).localeCompare(String(right.task.name), "zh-CN")
        );
      });
  }

  return {
    CADENCES: CADENCES.slice(),
    CADENCE_LABELS: Object.assign({}, CADENCE_LABELS),
    isCadence: isCadence,
    normalizeCompletions: normalizeCompletions,
    syncRecurringTaskStates: syncRecurringTaskStates,
    setCurrentPeriodCompleted: setCurrentPeriodCompleted,
    getDueSoonTasks: getDueSoonTasks
  };
});
