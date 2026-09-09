/* Pure, atomic plans for hierarchical archiving and bulk Task edits. */
(function (root, factory) {
  var dates = root.App && root.App.dateUtils || (typeof require === "function" ? require("./date-utils.js") : null);
  var api = factory(dates);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.App = root.App || {};
  root.App.bulkActions = api;
})(typeof self !== "undefined" ? self : globalThis, function (dates) {
  "use strict";
  var collections = { group: "groups", flow: "flows", task: "tasks" };
  function parentArchived(data, kind, item) {
    if (kind === "group") return false;
    var group = data.groups.find(function (g) { return g.id === item.groupId; });
    if (group && group.archivedAt) return true;
    var flow = kind === "task" && data.flows.find(function (f) { return f.id === item.flowId; });
    return Boolean(flow && flow.archivedAt);
  }
  function isArchived(data, kind, item) {
    return Boolean(item.archivedAt || parentArchived(data, kind, item));
  }
  function activeData(data) {
    var result = Object.assign({}, data);
    Object.keys(collections).forEach(function (kind) {
      result[collections[kind]] = data[collections[kind]].filter(function (item) {
        return !isArchived(data, kind, item);
      });
    });
    return result;
  }
  function selectedItems(data, kind, ids) {
    if (!collections[kind]) throw new Error("invalid-selection");
    var selected = new Set(ids);
    var items = data[collections[kind]].filter(function (item) { return selected.has(item.id); });
    if (!items.length || items.length !== selected.size) throw new Error("invalid-selection");
    return items;
  }
  function descendants(data, kind, item) {
    var records = [{ kind: kind, item: item }];
    if (kind === "group") data.flows.forEach(function (flow) {
      if (flow.groupId === item.id) records.push({ kind: "flow", item: flow });
    });
    if (kind !== "task") data.tasks.forEach(function (task) {
      if (kind === "group" ? task.groupId === item.id : task.flowId === item.id) {
        records.push({ kind: "task", item: task });
      }
    });
    return records;
  }
  function planArchive(data, kind, ids, restore, stamp, batchId) {
    var selected = selectedItems(data, kind, ids);
    var changes = new Map();
    selected.forEach(function (item) {
      if (restore ? parentArchived(data, kind, item) : isArchived(data, kind, item)) {
        throw new Error(restore ? "restore-parent-first" : "already-archived");
      }
      if (restore && !item.archivedAt) throw new Error("invalid-selection");
      descendants(data, kind, item).forEach(function (record) {
        var target = record.item;
        // Restoring a parent must not revive descendants archived separately earlier.
        var sameArchive = item.archiveBatchId
          ? target.archiveBatchId === item.archiveBatchId
          : target.archivedAt === item.archivedAt;
        if (restore ? target !== item && !sameArchive : isArchived(data, record.kind, target)) return;
        changes.set(record.kind + ":" + target.id, {
          kind: record.kind, id: target.id, name: target.name,
          before: JSON.parse(JSON.stringify(target)),
          after: Object.assign({}, target, {
            archivedAt: restore ? null : stamp,
            archiveBatchId: restore ? null : batchId,
            updatedAt: stamp
          })
        });
      });
    });
    return { type: restore ? "restore" : "archive", changes: Array.from(changes.values()), source: sourceState(data) };
  }
  function planEdit(data, kind, ids, patch, stamp) {
    var taskIds = new Set();
    selectedItems(data, kind, ids).forEach(function (item) {
      if (isArchived(data, kind, item)) throw new Error("already-archived");
      descendants(data, kind, item).forEach(function (record) {
        if (record.kind === "task" && !isArchived(data, "task", record.item)) taskIds.add(record.item.id);
      });
    });
    var mode = patch.ddlMode || "keep";
    if (!["keep", "set", "shift"].includes(mode)) throw new Error("invalid-date");
    if (mode === "set" && !dates.parseISODate(patch.ddl)) throw new Error("invalid-date");
    if (mode === "shift" && (!Number.isInteger(patch.days) || Math.abs(patch.days) > 3650)) throw new Error("invalid-shift");
    if (patch.urgency && !["high", "medium", "low"].includes(patch.urgency)) throw new Error("invalid-urgency");
    if (patch.managedObject !== undefined && String(patch.managedObject).trim().length > 160) throw new Error("invalid-person");
    var changes = [];
    data.tasks.forEach(function (task) {
      if (!taskIds.has(task.id)) return;
      var next = Object.assign({}, task);
      if (mode !== "keep") {
        next.ddl = mode === "set" ? patch.ddl : dates.addDays(task.ddl, patch.days);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(next.ddl) || !dates.parseISODate(next.ddl)) throw new Error("invalid-date");
        if (dates.isRecurringTask(task) && next.ddl !== task.ddl) {
          // Changing recurrence anchors can rewrite historical completion records.
          // Reject the entire plan, allowing other fields to be edited independently.
          throw new Error("recurring-ddl:" + task.name);
        }
      }
      if (patch.urgency) next.urgency = patch.urgency;
      if (patch.managedObject !== undefined) next.managedObject = String(patch.managedObject).trim();
      if (next.ddl === task.ddl && next.urgency === task.urgency && next.managedObject === task.managedObject) return;
      next.updatedAt = stamp;
      changes.push({ kind: "task", id: task.id, name: task.name, before: JSON.parse(JSON.stringify(task)), after: next });
    });
    return { type: "edit", changes: changes, source: sourceState(data) };
  }
  function sourceState(data) { return JSON.stringify([data.groups, data.flows, data.tasks]); }
  function applyPlan(data, plan) {
    if (plan.source !== sourceState(data)) throw new Error("stale-preview");
    // The preview is only valid while every affected record is unchanged.
    plan.changes.forEach(function (change) {
      var item = data[collections[change.kind]].find(function (row) { return row.id === change.id; });
      if (JSON.stringify(item) !== JSON.stringify(change.before)) throw new Error("stale-preview");
    });
    var next = JSON.parse(JSON.stringify(data));
    plan.changes.forEach(function (change) {
      var rows = next[collections[change.kind]];
      rows[rows.findIndex(function (row) { return row.id === change.id; })] = JSON.parse(JSON.stringify(change.after));
    });
    return next;
  }
  return { isArchived: isArchived, parentArchived: parentArchived, activeData: activeData,
    planArchive: planArchive, planEdit: planEdit, applyPlan: applyPlan };
});
