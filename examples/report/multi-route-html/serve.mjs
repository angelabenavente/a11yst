import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 4181);

const layout = (title, body) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | a11yst report fixture</title>
    <style>
      body { max-width: 48rem; margin: 3rem auto; padding: 0 1.25rem; font: 18px/1.5 system-ui; }
      nav { display: flex; gap: 1rem; margin-bottom: 2rem; }
      button, input { min-height: 3rem; font: inherit; }
    </style>
  </head>
  <body>
    <nav aria-label="Example pages">
      <a href="/">Home</a>
      <a href="/button">Button issue</a>
      <a href="/form">Form issue</a>
    </nav>
    <main>${body}</main>
  </body>
</html>`;

const pages = new Map([
  [
    "/",
    layout(
      "Home",
      "<h1>Accessible home</h1><p>This page intentionally has no known button-name, image-alt, or label issue.</p>",
    ),
  ],
  [
    "/button",
    layout(
      "Button issue",
      '<h1>Unnamed button</h1><p>The button below has no accessible name.</p><button type="button"></button>',
    ),
  ],
  [
    "/form",
    layout(
      "Form issue",
      '<h1>Unlabelled form</h1><p>The text field below has no associated label.</p><input type="text" name="reference">',
    ),
  ],
]);

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const page = pages.get(url.pathname);
  if (!page) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(page);
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`multi-route-html listening on http://127.0.0.1:${port}\n`);
});
