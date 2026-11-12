import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, CHARACTERS } from "./characters.mjs";
import { PROPS } from "./props.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "sprites");

function floor(name, size, draw) {
  const [w, h] = size;
  const rows = [];
  for (let y = 0; y < h; y += 1) {
    let row = "";
    for (let x = 0; x < w; x += 1) row += draw(x, y);
    rows.push(row);
  }
  return [name, rows];
}

const FLOORS = {
  scout: { a: "#1f3a40", b: "#234249" },
  scholar: { a: "#3a2c25", b: "#40312a" },
  wizard: { a: "#262a52", b: "#2b305a" },
  critic: { a: "#3a2333", b: "#41283a" },
  captain: { a: "#1f2d4a", b: "#243352" },
  helper: { a: "#283038", b: "#2d363f" },
  exec: { a: "#2e2146", b: "#33254d" },
};

const PLANKS = { builder: { a: "#3b2a22", b: "#41302a", s: "#2e2019" } };

const FLOOR_SIZE = [160, 240];

function floorSprites() {
  const list = [];
  for (const [role, c] of Object.entries(FLOORS)) {
    list.push([`floor-${role}`, { a: c.a, b: c.b }, floor(role, FLOOR_SIZE, (x, y) => ((Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? "b" : "a"))[1]]);
  }
  for (const [role, c] of Object.entries(PLANKS)) {
    list.push([`floor-${role}`, { a: c.a, b: c.b, s: c.s }, floor(role, FLOOR_SIZE, (x, y) => {
      const row = Math.floor(y / 6);
      const seam = y % 6 === 5 || (x + row * 13) % 32 === 0;
      return seam ? "s" : row % 2 ? "b" : "a";
    })[1]]);
  }
  return list;
}

function expand(base, frame) {
  if (Array.isArray(frame)) return frame;
  const rows = [...base];
  for (const [at, row] of Object.entries(frame)) rows[Number(at)] = row;
  return rows;
}

function svgOf(name, rows, palette) {
  const width = rows[0].length;
  const rects = [];
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${name}: row ${y} is ${row.length} wide, not ${width}`);
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === key) end += 1;
      if (key !== ".") {
        const fill = palette[key];
        if (!fill) throw new Error(`${name}: no colour for "${key}"`);
        rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${fill}"/>`);
      }
      x = end;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${rows.length}" width="${width}" height="${rows.length}" shape-rendering="crispEdges">${rects.join("")}</svg>\n`;
}

mkdirSync(OUT, { recursive: true });
for (const file of readdirSync(OUT)) if (file.endsWith(".svg") || file.startsWith("sizes.") || file.startsWith("floors.")) unlinkSync(join(OUT, file));

const sizes = {};
let written = 0;
for (const [name, sprite] of Object.entries({ ...CHARACTERS, ...PROPS })) {
  const palette = { ...BASE, ...sprite.palette };
  const first = sprite.frames[0];
  const frames = sprite.frames.map((f) => expand(first, f));
  frames.forEach((rows, i) => {
    const file = frames.length > 1 ? `${name}-${i}` : name;
    const variants = sprite.mirror ? [[file, rows], [`${file}-l`, rows.map((r) => [...r].reverse().join(""))]] : [[file, rows]];
    for (const [out, grid] of variants) {
      writeFileSync(join(OUT, `${out}.svg`), svgOf(out, grid, palette));
      sizes[out] = [grid[0].length, grid.length];
      written += 1;
    }
  });
}
for (const [name, palette, rows] of floorSprites()) {
  writeFileSync(join(OUT, `${name}.svg`), svgOf(name, rows, palette));
  sizes[name] = [rows[0].length, rows.length];
  written += 1;
}
writeFileSync(join(OUT, "sizes.js"), `export default ${JSON.stringify(sizes)};\n`);
const floorBase = Object.fromEntries([...Object.entries(FLOORS), ...Object.entries(PLANKS)].map(([key, c]) => [key, c.a]));
writeFileSync(join(OUT, "floors.js"), `export default ${JSON.stringify(floorBase)};\n`);
console.log(`${written} sprites → ${OUT}`);
