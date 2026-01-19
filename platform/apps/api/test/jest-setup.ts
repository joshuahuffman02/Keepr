import { afterAll } from "@jest/globals";

const getActiveHandles = (): unknown[] => {
  // @ts-expect-error _getActiveHandles is a Node internal API.
  const getter = process._getActiveHandles;
  return typeof getter === "function" ? getter() : [];
};

const getHandleType = (handle: unknown) => {
  const tag = Object.prototype.toString.call(handle);
  const match = /\[object (.+)\]/.exec(tag);
  return match ? match[1] : typeof handle;
};

const summarizeHandles = (handles: unknown[]) => {
  const counts = new Map<string, number>();
  for (const handle of handles) {
    const name = getHandleType(handle);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Object.fromEntries(counts.entries());
};

const describeHandles = (handles: unknown[]) =>
  handles.map((handle) => ({
    type: getHandleType(handle),
    tag: Object.prototype.toString.call(handle),
  }));

afterAll(async () => {
  if (process.env.JEST_CLOSE_UNDICI === "false") {
    return;
  }

  try {
    const { getGlobalDispatcher } = await import("undici");
    const dispatcher = typeof getGlobalDispatcher === "function" ? getGlobalDispatcher() : null;
    if (dispatcher && typeof dispatcher.close === "function") {
      await dispatcher.close();
    }
  } catch {
    // Ignore if undici is unavailable in this runtime.
  }

  if (process.env.JEST_DEBUG_HANDLES === "true") {
    const handles = getActiveHandles();
    // eslint-disable-next-line no-console
    console.log("Jest active handles:", summarizeHandles(handles));
    if (process.env.JEST_DEBUG_HANDLES_VERBOSE === "true") {
      // eslint-disable-next-line no-console
      console.log("Jest active handle details:", describeHandles(handles));
    }
  }
});
