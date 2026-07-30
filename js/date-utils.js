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

  function isOverdue(task, today) {
    return Boolean(
      task &&
        task.status !== "completed" &&
        parseISODate(task.ddl) &&
        formatDate(task.ddl) < (formatDate(today || new Date()) || todayISO())
    );
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
    isOverdue: isOverdue,
    completionRate: completionRate,
    dateTimeStamp: dateTimeStamp,
    friendlyWeekLabel: friendlyWeekLabel
  };
});
