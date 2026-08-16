import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 6401);

const routes = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/contact", "contact.html"],
  ["/contact.html", "contact.html"],
  ["/fixed", "fixed.html"],
  ["/fixed.html", "fixed.html"],
  ["/review", "review.html"],
  ["/review.html", "review.html"],
  ["/archive", "archive.html"],
  ["/archive.html", "archive.html"],
]);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const fileName = routes.get(url.pathname) ?? url.pathname.replace(/^\//, "");

  try {
    const body = await readFile(join(__dirname, fileName));
    response.writeHead(200, {
      "content-type": mime[extname(fileName)] ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `baseline/legacy-html listening on http://127.0.0.1:${port}\n`,
  );
});
