/* 本地日期与自然周计算。所有 YYYY-MM-DD 都按浏览器本地时区解析。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.dateUtils = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  var ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function parseISODate(value) {
    if (value instanceof Date) {
      var copy = new Date(value.getFullYear(), value.getMonth(), value.getDate());
      return Number.isNaN(copy.getTime()) ? null : copy;
    }
    var match = ISO_DATE.exec(String(value || ""));
    if (!match) return null;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatDate(value) {
    var date = parseISODate(value);
    if (!date) return "";
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function todayISO(now) {
    return formatDate(now instanceof Date ? now : new Date());
  }

  function addDays(value, amount) {
    var date = parseISODate(value);
    if (!date) return "";
    date.setDate(date.getDate() + Number(amount || 0));
    return formatDate(date);
  }

  function startOfWeek(value) {
    var date = parseISODate(value);
    if (!date) return "";
    var daysSinceMonday = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - daysSinceMonday);
    return formatDate(date);
  }

  function endOfWeek(value) {
    var monday = startOfWeek(value);
    return monday ? addDays(monday, 6) : "";
  }

  function getWeekFriday(value) {
    var monday = startOfWeek(value);
    return monday ? addDays(monday, 4) : "";
  }

  function addWeeksFriday(friday, weeks) {
    var normalized = getWeekFriday(friday);
    return normalized ? addDays(normalized, Number(weeks || 0) * 7) : "";
  }

  function compareDates(left, right) {
    var a = formatDate(left);
    var b = formatDate(right);
    if (!a || !b) return 0;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function daysBetween(left, right) {
    var a = parseISODate(left);
    var b = parseISODate(right);
    if (!a || !b) return 0;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function buildWeekRange(startValue, endValue, maxWeeks) {
    var start = getWeekFriday(startValue);
    var end = getWeekFriday(endValue);
    if (!start || !end) return [];
    if (start > end) {
      var swap = start;
      start = end;
      end = swap;
    }
    var weeks = [];
    var cursor = start;
    var limit = Number(maxWeeks || 600);
    while (cursor <= end && weeks.length < limit) {
      weeks.push(cursor);
      cursor = addWeeksFriday(cursor, 1);
    }
    return weeks;
  }

  function recurrenceCadence(task) {
    var value = String((task && task.recurrenceCadence) || "none");
    return value === "weekly" || value === "monthly" ? value : "none";
  }

  function isRecurringTask(task) {
    return Boolean(
      task &&
        recurrenceCadence(task) !== "none" &&
        parseISODate(task.ddl) &&
        parseISODate(task.recurrenceStart) &&
        parseISODate(task.recurrenceEnd) &&
        formatDate(task.recurrenceStart) <= formatDate(task.recurrenceEnd)
    );
  }

  function recurrencePeriodKey(cadence, value) {
    var date = formatDate(value);
    if (!date) return "";
    if (cadence === "weekly") return startOfWeek(date);
    if (cadence === "monthly") return date.slice(0, 7);
    return "";
  }

  function getRecurringOccurrences(task, maxOccurrences) {
    if (!isRecurringTask(task)) return [];
    var cadence = recurrenceCadence(task);
    var start = formatDate(task.recurrenceStart);
    var end = formatDate(task.recurrenceEnd);
    var anchor = parseISODate(task.ddl);
    var limit = Math.max(1, Number(maxOccurrences || 5000));
    var occurrences = [];
    if (cadence === "weekly") {
      var startDate = parseISODate(start);
      var offset = (anchor.getDay() - startDate.getDay() + 7) % 7;
      var cursor = addDays(start, offset);
      while (cursor && cursor <= end && occurrences.length < limit) {
        occurrences.push({
          ddl: cursor,
          periodKey: recurrencePeriodKey(cadence, cursor)
        });
        cursor = addDays(cursor, 7);
      }
      return occurrences;
    }
    var startMonth = parseISODate(start);
    var monthCursor = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
    var anchorDay = anchor.getDate();
    while (occurrences.length < limit) {
      var lastDay = new Date(
        monthCursor.getFullYear(),
        monthCursor.getMonth() + 1,
        0
      ).getDate();
      var occurrence = new Date(
        monthCursor.getFullYear(),
        monthCursor.getMonth(),
        Math.min(anchorDay, lastDay)
      );
      var occurrenceDate = formatDate(occurrence);
      if (occurrenceDate > end) break;
      if (occurrenceDate >= start) {
        occurrences.push({
          ddl: occurrenceDate,
          periodKey: recurrencePeriodKey(cadence, occurrenceDate)
        });
      }
      monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
      if (formatDate(monthCursor) > end) break;
    }
    return occurrences;
  }

  function getRecurringCompletion(task, occurrence) {
    if (!occurrence) return null;
    return (
      (Array.isArray(task && task.recurrenceCompletions)
        ? task.recurrenceCompletions
        : []
      ).find(function (record) {
        return record.periodKey === occurrence.periodKey;
      }) || null
    );
  }

  function getTaskPeriodState(task, today) {
    var currentDate = formatDate(today || new Date()) || todayISO();
    if (!isRecurringTask(task)) {
      var normalCompleted = task && task.status === "completed";
      return {
        recurring: false,
        cadence: "none",
        occurrence: task && parseISODate(task.ddl)
          ? { ddl: formatDate(task.ddl), periodKey: "" }
          : null,
        currentOccurrence: null,
        checkboxEnabled: true,
        completed: normalCompleted,
        completedAt: normalCompleted ? formatDate(task.completedAt) : null,
        overdue: Boolean(
          task && !normalCompleted && parseISODate(task.ddl) && formatDate(task.ddl) < currentDate
        )
      };
    }
    var cadence = recurrenceCadence(task);
    var occurrences = getRecurringOccurrences(task);
    var currentKey = recurrencePeriodKey(cadence, currentDate);
    var currentOccurrence = occurrences.find(function (occurrence) {
      return occurrence.periodKey === currentKey;
    }) || null;
    var withinSchedule =
      currentDate >= formatDate(task.recurrenceStart) &&
      currentDate <= formatDate(task.recurrenceEnd);
    var checkboxEnabled = Boolean(currentOccurrence && withinSchedule);
    var relevant = currentOccurrence;
    if (!relevant) {
      relevant = occurrences.find(function (occurrence) {
        return occurrence.ddl >= currentDate;
      }) || occurrences[occurrences.length - 1] || null;
    }
    var completion = null;
    if (checkboxEnabled) {
      completion = getRecurringCompletion(task, currentOccurrence);
    } else if (currentDate > formatDate(task.recurrenceEnd) && relevant) {
      completion = getRecurringCompletion(task, relevant);
    }
    var completed = Boolean(completion);
    var overdue = Boolean(
      relevant &&
        !completed &&
        relevant.ddl < currentDate &&
        (checkboxEnabled || currentDate > formatDate(task.recurrenceEnd))
    );
    return {
      recurring: true,
      cadence: cadence,
      occurrence: relevant,
      currentOccurrence: currentOccurrence,
      checkboxEnabled: checkboxEnabled,
      completed: completed,
      completedAt: completion ? formatDate(completion.completedAt) : null,
      overdue: overdue,
      occurrences: occurrences
    };
  }

  function taskEffectiveDdl(task, today) {
    var state = getTaskPeriodState(task, today);
    return state.occurrence ? state.occurrence.ddl : formatDate(task && task.ddl);
  }

  function isOverdue(task, today) {
    return getTaskPeriodState(task, today).overdue;
  }

  function completionRate(completed, total) {
    var safeTotal = Number(total || 0);
    if (safeTotal <= 0) return 0;
    return Math.round((Number(completed || 0) / safeTotal) * 1000) / 10;
  }

  function dateTimeStamp(now) {
    var date = now instanceof Date ? now : new Date();
    return (
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      "_" +
      pad(date.getHours()) +
      pad(date.getMinutes())
    );
  }

  function friendlyWeekLabel(friday) {
    var monday = startOfWeek(friday);
    var sunday = endOfWeek(friday);
    if (!monday || !sunday) return "";
    return monday.slice(5) + " — " + sunday.slice(5);
  }

  return {
    parseISODate: parseISODate,
    formatDate: formatDate,
    todayISO: todayISO,
    addDays: addDays,
    startOfWeek: startOfWeek,
    endOfWeek: endOfWeek,
    getWeekFriday: getWeekFriday,
    addWeeksFriday: addWeeksFriday,
    compareDates: compareDates,
    daysBetween: daysBetween,
    buildWeekRange: buildWeekRange,
    recurrenceCadence: recurrenceCadence,
    isRecurringTask: isRecurringTask,
    recurrencePeriodKey: recurrencePeriodKey,
    getRecurringOccurrences: getRecurringOccurrences,
    getRecurringCompletion: getRecurringCompletion,
    getTaskPeriodState: getTaskPeriodState,
    taskEffectiveDdl: taskEffectiveDdl,
    isOverdue: isOverdue,
    completionRate: completionRate,
    dateTimeStamp: dateTimeStamp,
    friendlyWeekLabel: friendlyWeekLabel
  };
});
