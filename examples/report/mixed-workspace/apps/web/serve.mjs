import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 6181);
const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mixed workspace web app</title>
  </head>
  <body>
    <main>
      <h1>Mixed workspace web app</h1>
      <p>This controlled web project runs from a monorepo-style workspace.</p>
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
  process.stdout.write(`mixed-workspace web listening on http://127.0.0.1:${port}\n`);
});
