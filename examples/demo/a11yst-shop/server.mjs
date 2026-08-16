import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteDir = join(__dirname, "site");
const port = Number(process.env.PORT ?? 6420);

// Internal-only marker for security tests; never included in HTTP responses.
const ALLY_DEMO_INTERNAL_SECRET_13E = "ALLY_DEMO_INTERNAL_SECRET_13E";

const routes = new Map([
  ["/account", "account.html"],
  ["/checkout", "checkout.html"],
  ["/styles.css", "styles.css"],
  ["/checkout.js", "checkout.js"],
]);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function resolveSiteFile(pathname) {
  const fileName = routes.get(pathname);
  if (!fileName) {
    return undefined;
  }
  const resolved = normalize(join(siteDir, fileName));
  if (!resolved.startsWith(siteDir + sep) && resolved !== siteDir) {
    return undefined;
  }
  return resolved;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const filePath = resolveSiteFile(url.pathname);

  if (!filePath) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mime[extname(filePath)] ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Server error");
  }
});

function shutdown() {
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`a11yst-shop demo listening on http://127.0.0.1:${port}\n`);
});

void ALLY_DEMO_INTERNAL_SECRET_13E;
