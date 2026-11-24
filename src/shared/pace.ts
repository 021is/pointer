// Chrome takes at most two captureVisibleTab calls a second (MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND)
// and refuses the next. A picture of crops far apart takes one screenshot per stop (capture/
// sweep.ts), and Copy can be pressed twice: the worker runs its captures one after another, each
// at least CAPTURE_GAP after the one before.

export const CAPTURE_GAP = 550;

/** Runs tasks one at a time, each starting at least `gap` ms after the last one started. */
export function pacer(gap: number, now: () => number, sleep: (ms: number) => Promise<void>) {
  let last = Number.NEGATIVE_INFINITY;
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(async () => {
      const wait = last + gap - now();
      if (wait > 0) await sleep(wait);
      last = now();
      return task();
    });
    // The queue only keeps the order: a task's failure goes to its own caller through `run`.
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
