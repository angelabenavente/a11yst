import { createServer } from "node:net";

/**
 * Reserve an ephemeral TCP port from the OS, then immediately release it.
 *
 * There is an inherent (tiny) TOCTOU race between releasing the port here
 * and a caller binding to it, but it is more than good enough for test
 * fixtures that need "a free port" or "a port nothing is listening on".
 */
export async function getFreePort(): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not determine an ephemeral port."));
        return;
      }
      const { port } = address;
      server.close(() => resolvePromise(port));
    });
  });
}
