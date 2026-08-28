// The legacy provider timeout is hard-coded to 90 seconds. Accelerate only long timers in this
// one characterization child so its existing timeout/error branch can be exercised without a
// three-minute two-attempt test. Product code, retry count, abort handling, and mapping stay real.
const nativeSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback, milliseconds, ...arguments_) =>
  nativeSetTimeout(callback, milliseconds >= 90_000 ? 50 : milliseconds, ...arguments_);
