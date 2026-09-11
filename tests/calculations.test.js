import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAverages,
  calculateHandicapIndex,
  courseHandicap,
  handicapSelection,
  scoreDifferential,
  sumHoles
} from "../calculations.js";

test("sums an 18-hole score", () => {
  assert.equal(sumHoles(Array(18).fill(5)), 90);
});

test("calculates the official score differential example", () => {
  assert.equal(scoreDifferential(95, 71.5, 125), 21.2);
});

test("applies PCC in the differential formula", () => {
  assert.equal(scoreDifferential(80, 72, 113, 1), 7);
});

test("uses the WHS fewer-than-20 selection table", () => {
  assert.deepEqual(handicapSelection(3), { use: 1, adjustment: -2 });
  assert.deepEqual(handicapSelection(6), { use: 2, adjustment: -1 });
  assert.deepEqual(handicapSelection(12), { use: 4, adjustment: 0 });
  assert.deepEqual(handicapSelection(20), { use: 8, adjustment: 0 });
});

test("calculates an initial index from three rounds", () => {
  const rounds = [10, 12, 14].map((differential, index) => ({
    id: String(index),
    date: `2026-08-${String(index + 1).padStart(2, "0")}`,
    total: 72 + differential,
    courseRating: 72,
    slope: 113
  }));
  const result = calculateHandicapIndex(rounds);
  assert.equal(result.index, 8);
  assert.equal(result.usedCount, 1);
});

test("source-linked shared results use the normal handicap calculation path", () => {
  const rounds = [
    { id: "shared-nine", sourceSessionId: "session-9", holeCount: 9, date: "2026-09-01", total: 40, courseRating: 35.7, slope: 128, pcc: 0 },
    { id: "shared-eighteen", sourceSessionId: "session-18", holeCount: 18, date: "2026-09-02", total: 84, courseRating: 71.4, slope: 128, pcc: 0 },
    { id: "individual", date: "2026-09-03", total: 82, courseRating: 71.4, slope: 128, pcc: 0 }
  ];

  const result = calculateHandicapIndex(rounds);
  assert.equal(result.totalCount, 3);
  assert.equal(result.usedCount, 1);
  assert.deepEqual(result.usedRoundIds, ["shared-nine"]);
  assert.equal(result.index, 1.8);
});

test("calculates course handicap with rating minus par", () => {
  assert.equal(courseHandicap(10, 125, 71.5, 72), 11);
});

test("calculates all-time, recent, best, and to-par averages", () => {
  const rounds = [
    { total: 90, par: 72, date: "2026-01-01" },
    { total: 84, par: 72, date: "2026-02-01" }
  ];
  assert.deepEqual(calculateAverages(rounds), {
    rounds: 2,
    average: 87,
    recentAverage: 87,
    best: 84,
    averageToPar: 15
  });
});
