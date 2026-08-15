import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 6212);

const layout = (title, body, extraStyles = "") => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Large-text profile fixture</title>
    <style>
      body { max-width: 56rem; margin: 2rem auto; padding: 0 1.25rem; font: 18px/1.5 system-ui; }
      nav { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem; }
      ${extraStyles}
    </style>
  </head>
  <body>
    <nav aria-label="Fixture pages">
      <a href="/good">Good</a>
      <a href="/overflow">Overflow</a>
      <a href="/clip">Clip</a>
      <a href="/overlap">Overlap</a>
    </nav>
    <main>${body}</main>
  </body>
</html>`;

const pages = new Map([
  [
    "/good",
    layout(
      "Good scaling",
      `<h1>Good scaling</h1>
       <p>This paragraph uses flexible width and wraps naturally when text is enlarged to 200%.</p>
       <p>Another block of content with enough room to reflow without clipping or horizontal scroll.</p>`,
    ),
  ],
  [
    "/overflow",
    layout(
      "Horizontal overflow",
      `<h1>Horizontal overflow</h1>
       <div class="fixed-box">
         <p>This paragraph sits in a fixed 240px container. At 200% text scale the content overflows horizontally.</p>
       </div>`,
      `.fixed-box { width: 240px; border: 1px solid #888; padding: 0.5rem; white-space: nowrap; }`,
    ),
  ],
  [
    "/clip",
    layout(
      "Clipped text",
      `<h1>Clipped text</h1>
       <div class="clip-box">
         <p>Overflow hidden on a short box clips this paragraph when text is scaled up.</p>
       </div>`,
      `.clip-box { width: 100%; max-width: 20rem; height: 3.5rem; overflow: hidden; border: 1px solid #888; padding: 0.5rem; }`,
    ),
  ],
  [
    "/overlap",
    layout(
      "Overlapping elements",
      `<h1>Overlapping elements</h1>
       <div class="overlap-stage">
         <p class="overlap-body">Body copy that grows taller at 200% text scale.</p>
         <div class="overlap-badge" aria-hidden="true">Fixed badge</div>
       </div>`,
      `.overlap-stage { position: relative; min-height: 6rem; }
       .overlap-body { margin: 0; padding-right: 8rem; }
       .overlap-badge { position: fixed; top: 8rem; right: 2rem; width: 7rem; padding: 0.75rem; background: #ffd966; border: 2px solid #333; text-align: center; }`,
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
  process.stdout.write(`profiles/large-text listening on http://127.0.0.1:${port}\n`);
});
