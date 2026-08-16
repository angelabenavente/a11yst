import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 6215);
const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Profiles mixed workspace web</title>
    <style>
      body { max-width: 40rem; margin: 3rem auto; padding: 0 1.25rem; font: 18px/1.5 system-ui; }
    </style>
  </head>
  <body>
    <main>
      <h1>Profiles mixed workspace web</h1>
      <p>Web project runs all four a11yst profiles from a monorepo-style workspace.</p>
    </main>
  </body>
</html>`;

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  if (url.pathname !== "/") {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(page);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`profiles/mixed-workspace web listening on http://127.0.0.1:${port}\n`);
});
