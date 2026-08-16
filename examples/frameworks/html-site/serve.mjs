import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT ?? 4191);

const mime = {
  ".html": "text/html; charset=utf-8",
};

async function resolveFile(pathname) {
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const indexCandidate = join(root, normalized, "index.html");
  if (existsSync(indexCandidate)) {
    return indexCandidate;
  }

  if (pathname === "/" || pathname === "") {
    return join(root, "index.html");
  }

  const direct = join(root, pathname);
  if (existsSync(direct) && extname(direct) === ".html") {
    return direct;
  }

  return undefined;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  const filePath = await resolveFile(url.pathname);

  if (!filePath) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mime[extname(filePath)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `html-site example listening on http://127.0.0.1:${port}\n`,
  );
});
