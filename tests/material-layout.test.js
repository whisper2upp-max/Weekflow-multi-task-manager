const test = require("node:test");
const assert = require("node:assert/strict");

const storage = require("../js/storage.js");
const materials = require("../js/materials.js");

function group(id, name, order) {
  return {
    id,
    name,
    order,
    color: "#665CFF",
    collapsed: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z"
  };
}

test("legacy JSON without preferences restores with List and four-column defaults", () => {
  const checked = storage.validateData({
    version: 3,
    groups: [group("group-b", "Beta", 2), group("group-a", "Alpha", 1)],
    flows: [],
    tasks: [],
    materials: [],
    updatedAt: "2026-08-14T00:00:00.000Z"
  });

  assert.equal(checked.valid, true, checked.errors.join("\n"));
  assert.deepEqual(checked.data.preferences.documentLibrary, {
    layout: "list",
    columns: 4,
    groupOrder: ["group-a", "group-b", "__ungrouped__"]
  });
});

test("Document Library layout preferences survive JSON validation and normalization", () => {
  const source = {
    version: 3,
    groups: [group("group-a", "Alpha", 1), group("group-b", "Beta", 2)],
    flows: [],
    tasks: [],
    materials: [],
    preferences: {
      documentLibrary: {
        layout: "group",
        columns: 3,
        groupOrder: ["group-b", "__ungrouped__", "group-a"]
      }
    },
    updatedAt: "2026-08-14T00:00:00.000Z"
  };

  const checked = storage.validateData(JSON.parse(JSON.stringify(source)));
  assert.equal(checked.valid, true, checked.errors.join("\n"));
  assert.deepEqual(checked.data.preferences, source.preferences);
});

test("Group layout sorts documents by recent open count, then title", () => {
  const now = new Date("2026-08-14T12:00:00.000Z");
  const items = [
    { title: "Zulu", openEvents: ["2026-08-13T09:00:00.000Z"] },
    {
      title: "Beta",
      openEvents: ["2026-08-07T09:00:00.000Z", "2026-08-12T09:00:00.000Z"]
    },
    {
      title: "Alpha",
      openEvents: ["2026-08-06T09:00:00.000Z", "2026-08-11T09:00:00.000Z"]
    }
  ];

  assert.deepEqual(
    materials.sortByRecentUsage(items, now).map((item) => item.title),
    ["Alpha", "Beta", "Zulu"]
  );
});
