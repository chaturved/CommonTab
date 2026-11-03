import test from "node:test";
import assert from "node:assert/strict";
import { parseAmount, parsePercentage, splitBill } from "./money.mjs";

test("splits bill and tip without losing a cent", () => {
  const result = splitBill(1001, 1500, 3);
  assert.equal(result.tipCents, 150);
  assert.equal(result.totalCents, 1151);
  assert.deepEqual(result.shares, [384, 384, 383]);
  assert.equal(result.shares.reduce((sum, share) => sum + share, 0), result.totalCents);
});

test("rounds fractional tip cents like the iOS calculator", () => {
  assert.equal(splitBill(1, 5000, 1).tipCents, 1);
  assert.equal(splitBill(8450, 1800, 2).totalCents, 9971);
});

test("rejects invalid currency and percentage inputs", () => {
  assert.equal(parseAmount("12.345"), null);
  assert.equal(parseAmount("-3"), null);
  assert.equal(parseAmount("1000000000"), 100_000_000_000);
  assert.equal(parsePercentage("100.01"), null);
  assert.equal(parsePercentage("18.5"), 1850);
});
