import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 6211);

const layout = (title, body) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Keyboard profile fixture</title>
    <style>
      body { max-width: 48rem; margin: 2rem auto; padding: 0 1.25rem; font: 18px/1.5 system-ui; }
      nav { display: flex; gap: 1rem; margin-bottom: 2rem; }
      a, button { min-height: 2.75rem; font: inherit; }
      .offscreen-link { position: absolute; left: -9999px; top: 0; }
      .trap { margin-top: 2rem; padding: 1rem; border: 1px solid #ccc; }
    </style>
  </head>
  <body>
    <nav aria-label="Fixture pages">
      <a href="/">Good order</a>
      <a href="/issues">Issues</a>
    </nav>
    <main>${body}</main>
  </body>
</html>`;

const pages = new Map([
  [
    "/",
    layout(
      "Good focus order",
      `<h1>Good focus order</h1>
       <p>Tab through the page in natural document order.</p>
       <p><a href="/issues">Go to keyboard issues</a></p>
       <button type="button">Primary action</button>
       <p><a href="#footer">Skip to footer</a></p>
       <footer id="footer"><p>Footer landmark with a <a href="/">home link</a>.</p></footer>`,
    ),
  ],
  [
    "/issues",
    layout(
      "Keyboard issues",
      `<h1>Keyboard issues</h1>
       <p>Intentional tabindex and focus-order problems for the keyboard profile.</p>
       <a href="/" tabindex="1">Tabindex 1 link (jumps ahead)</a>
       <p><button type="button" tabindex="2">Tabindex 2 button</button></p>
       <a href="/issues" class="offscreen-link" tabindex="0">Offscreen link</a>
       <div class="trap" aria-label="Focus trap loop">
         <p>Three links with positive tabindex forming a loop:</p>
         <a href="#trap-a" tabindex="10">Trap A</a>
         <a href="#trap-b" tabindex="11">Trap B</a>
         <a href="#trap-c" tabindex="12">Trap C</a>
       </div>`,
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
  process.stdout.write(`profiles/keyboard listening on http://127.0.0.1:${port}\n`);
});
