import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { WALL_PX, normalize, packFloor } from "./data.js";

const HOST = new URL("./test-host.js", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (["gpui-kit", "gpui-base", "herdr"].includes(specifier)) return { url: HOST, shortCircuit: true };
    return next(specifier, context);
  },
});

const { building } = await import("./scene.js");
const { default: SIZES } = await import("./sprites/sizes.js");

const CELL = 3;
const SLOT = 34 * CELL + 8 + 6;
const PAD = 8 * 2 - 6 + 2;
const TILE = SIZES["floor-exec"][0] * CELL;
const theme = new Proxy({}, { get: (_target, key) => (typeof key === "string" ? "#808080" : undefined) });

const callsOf = (node, name) => node.calls.filter(([prop]) => prop === name).map(([, args]) => args);
const idOf = (node) => callsOf(node, "id")[0]?.[0] ?? null;
const kidsOf = (node) => node.kids.filter((kid) => typeof kid === "object").map((kid) => kid.node);
const positiveGap = (node) => callsOf(node, "gap").some(([value]) => value > 0);

function walk(node, visit) {
  visit(node);
  for (const kid of kidsOf(node)) walk(kid, visit);
}

function floorTiles(room) {
  const area = kidsOf(room)[1];
  const strip = kidsOf(area)[0];
  return kidsOf(strip).filter((kid) => kid.kind === "image" && /sprites\/floor-/.test(kid.path)).length;
}

function snapshotWith(roles) {
  let n = 0;
  const agents = Object.entries(roles).flatMap(([role, count]) => Array.from({ length: count }, () => {
    n += 1;
    return { id: `a${n}`, role, status: n % 2 ? "running" : "idle", nickname: `Agent ${n}` };
  }));
  return normalize({ v: 1, at: 1, agents, coordinator: { state: "thinking" }, owner: { prompt: "hello" } });
}

const SHAPES = {
  lead: { scout: 1, wizard: 3, builder: 3 },
  portal: { scout: 1, wizard: 1, builder: 6, critic: 1, captain: 1 },
};

for (const [name, roles] of Object.entries(SHAPES)) {
  for (const width of [340, 520, 809, 900]) {
    test(`${name} at ${width} px renders one gapless building: shared walls, stretched rows, growing rooms, covered floors`, () => {
      const root = building({ selected: null, now: 1 }, theme, true, snapshotWith(roles), 1, width).node;
      const inner = width - 2 * WALL_PX;
      assert.equal(idOf(root), "ao-building");
      walk(root, (node) => {
        const id = idOf(node) ?? "";
        if (id === "ao-building" || /^ao-(floor|suite)-row/.test(id)) assert.equal(positiveGap(node), false, `${id} has a gap`);
      });

      const sections = kidsOf(root);
      sections.slice(1).forEach((section) => assert.deepEqual(callsOf(section, "border_t"), [[WALL_PX]], `${idOf(section)} needs a shared wall`));
      assert.equal(idOf(sections[0]), "ao-lobby");
      assert.ok(floorTiles(sections[0]) * TILE >= inner, "lobby floor tiles fall short");

      if (width - 2 * WALL_PX < 520) {
        assert.deepEqual(sections.slice(1, 3).map(idOf), ["ao-chief", "ao-advisor"]);
      } else {
        assert.equal(idOf(sections[1]), "ao-suite-row");
        assert.deepEqual(kidsOf(sections[1]).map(idOf), ["ao-chief", "ao-advisor"]);
      }

      const rows = sections.filter((section) => /^ao-(floor|suite)-row/.test(idOf(section) ?? ""));
      for (const row of rows) {
        assert.equal(callsOf(row, "items_stretch").length, 1, `${idOf(row)} must stretch its rooms to one height`);
        assert.equal(callsOf(row, "items_start").length, 0);
        kidsOf(row).forEach((room, i) => {
          assert.deepEqual(callsOf(room, "flex_basis"), [[0]]);
          assert.ok(callsOf(room, "flex_grow")[0]?.[0] > 0, `${idOf(room)} must grow to fill the row`);
          assert.equal(callsOf(room, "border_l").length, i === 0 ? 0 : 1);
        });
      }

      const packed = packFloor(Object.values(roles), inner, SLOT, PAD);
      const floorRows = rows.filter((row) => idOf(row).startsWith("ao-floor-row"));
      assert.equal(floorRows.length, packed.length);
      floorRows.forEach((row, r) => kidsOf(row).forEach((room, i) => {
        assert.ok(floorTiles(room) * TILE >= packed[r].rooms[i].width, `${idOf(room)} floor tiles fall short`);
      }));
    });
  }
}

const findRoom = (root, id) => {
  let found = null;
  walk(root, (node) => {
    if (idOf(node) === id) found = node;
  });
  return found;
};
const propsIn = (room, name) => {
  let count = 0;
  walk(room, (node) => {
    if (node.kind === "image" && node.path?.endsWith(`/${name}.svg`)) count += 1;
  });
  return count;
};

test("a room whose desks fill its line gets no floor prop, and a roomy one does", () => {
  const exact = building({ selected: null, now: 1 }, theme, true, snapshotWith({ builder: 6 }), 1, 6 * SLOT + PAD + 2 * WALL_PX).node;
  assert.equal(propsIn(findRoom(exact, "ao-room-builder"), "cooler"), 0);
  const roomy = building({ selected: null, now: 1 }, theme, true, snapshotWith({ builder: 6 }), 1, 900).node;
  assert.equal(propsIn(findRoom(roomy, "ao-room-builder"), "cooler"), 1);
});

test("a selected agent's detail strip follows its row inside the building, wall to wall", () => {
  const snapshot = snapshotWith(SHAPES.lead);
  const chosen = snapshot.agents.find((a) => a.role === "wizard");
  const root = building({ selected: chosen.id, now: 1 }, theme, true, snapshot, 1, 809).node;
  const ids = kidsOf(root).map(idOf);
  const strip = ids.indexOf("ao-detail-strip");
  assert.ok(strip > 0);
  const rowAbove = kidsOf(root)[strip - 1];
  assert.ok(kidsOf(rowAbove).some((room) => idOf(room) === "ao-room-wizard"));
  assert.deepEqual(callsOf(kidsOf(root)[strip], "border_t"), [[WALL_PX]]);
  assert.equal(positiveGap(root), false);
});
