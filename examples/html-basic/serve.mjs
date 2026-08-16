import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pagesDir = join(__dirname, "pages");
const port = Number(process.env.PORT ?? 4173);

const routes = new Map([
  ["/", "index.html"],
  ["/about", "about.html"],
  ["/index.html", "index.html"],
  ["/about.html", "about.html"],
]);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const fileName = routes.get(url.pathname);

  if (!fileName) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  try {
    const body = await readFile(join(pagesDir, fileName));
    res.writeHead(200, {
      "content-type": mime[extname(fileName)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Server error");
  }
});

server.listen(port, () => {
  process.stdout.write(
    `html-basic example listening on http://localhost:${port}\n`,
  );
});
