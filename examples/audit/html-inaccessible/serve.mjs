import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 4178);

const routes = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
]);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const fileName = routes.get(url.pathname) ?? url.pathname.replace(/^\//, "");

  try {
    const body = await readFile(join(__dirname, fileName));
    res.writeHead(200, {
      "content-type": mime[extname(fileName)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(port, () => {
  process.stdout.write(
    `audit/html-inaccessible example listening on http://localhost:${port}\n`,
  );
});
