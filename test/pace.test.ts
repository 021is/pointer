// The worker's screenshots within Chrome's two a second: one at a time, in order, each at least
// the gap after the one before; a refused one still lets the next run, and its caller hears why.
import { describe, expect, it } from "vitest";
import { CAPTURE_GAP, pacer } from "../src/shared/pace";

/** A clock that sleeping moves on. */
function clock() {
  let t = 1000;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    pass: (ms: number) => {
      t += ms;
    },
    sleeps,
  };
}

describe("pacer", () => {
  it("keeps Chrome's limit: at most two captures a second", () => {
    expect(CAPTURE_GAP).toBeGreaterThan(500);
  });

  it("runs the first at once, then each the gap after the last one started, in order", async () => {
    const c = clock();
    const paced = pacer(550, c.now, c.sleep);
    const started: number[] = [];
    const task = (n: number) => async () => {
      started.push(c.now());
      return n;
    };
    const results = await Promise.all([paced(task(1)), paced(task(2)), paced(task(3))]);
    expect(results).toEqual([1, 2, 3]);
    expect(started).toEqual([1000, 1550, 2100]);
    c.pass(2000);
    await paced(task(4));
    expect(c.sleeps).toEqual([550, 550]);
  });

  it("a refused task tells its caller, and the next still runs", async () => {
    const c = clock();
    const paced = pacer(550, c.now, c.sleep);
    const refused = paced(async () => {
      throw new Error("capture refused");
    });
    const next = paced(async () => "taken");
    await expect(refused).rejects.toThrow("capture refused");
    await expect(next).resolves.toBe("taken");
  });
});
