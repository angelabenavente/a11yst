import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 6213);

const layout = (title, body, extraStyles = "") => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Reduced-motion profile fixture</title>
    <style>
      body { max-width: 48rem; margin: 2rem auto; padding: 0 1.25rem; font: 18px/1.5 system-ui; }
      nav { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem; }
      ${extraStyles}
    </style>
  </head>
  <body>
    <nav aria-label="Fixture pages">
      <a href="/good">Good</a>
      <a href="/bad-infinite">Bad infinite</a>
      <a href="/long-transform">Long transform</a>
      <a href="/fade-control">Fade control</a>
    </nav>
    <main>${body}</main>
  </body>
</html>`;

const pages = new Map([
  [
    "/good",
    layout(
      "Respects reduced motion",
      `<h1>Respects reduced motion</h1>
       <div class="pulse" aria-hidden="true"></div>
       <p>The pulse animation stops when the user prefers reduced motion.</p>`,
      `.pulse { width: 3rem; height: 3rem; border-radius: 50%; background: #4a90d9; animation: pulse 1.2s ease-in-out infinite; }
       @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.7; } }
       @media (prefers-reduced-motion: reduce) {
         .pulse { animation: none; opacity: 0.85; }
       }`,
    ),
  ],
  [
    "/bad-infinite",
    layout(
      "Infinite spinner",
      `<h1>Infinite spinner</h1>
       <div class="spinner" role="img" aria-label="Loading"></div>
       <p>This spinner ignores prefers-reduced-motion and spins forever.</p>`,
      `.spinner { width: 3rem; height: 3rem; border: 4px solid #ddd; border-top-color: #333; border-radius: 50%; animation: spin 0.8s linear infinite; }
       @keyframes spin { to { transform: rotate(360deg); } }`,
    ),
  ],
  [
    "/long-transform",
    layout(
      "Long transform",
      `<h1>Long transform</h1>
       <div class="slide" aria-hidden="true"></div>
       <p>A 600ms transform animation that should fail the reduced-motion profile.</p>`,
      `.slide { width: 4rem; height: 4rem; background: #e67e22; animation: slide 600ms ease-in-out infinite alternate; }
       @keyframes slide { from { transform: translateX(0); } to { transform: translateX(120px); } }`,
    ),
  ],
  [
    "/fade-control",
    layout(
      "Brief fade",
      `<h1>Brief fade</h1>
       <button type="button" class="fade-btn">Toggle panel</button>
       <div class="fade-panel" id="panel">Short 100ms opacity transition (control).</div>`,
      `.fade-btn { font: inherit; min-height: 2.75rem; margin-bottom: 1rem; }
       .fade-panel { padding: 1rem; background: #eef6ff; border: 1px solid #99c; transition: opacity 100ms ease; opacity: 1; }
       .fade-panel.is-hidden { opacity: 0; }
       @media (prefers-reduced-motion: reduce) {
         .fade-panel { transition: none; }
       }`,
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
  process.stdout.write(`profiles/reduced-motion listening on http://127.0.0.1:${port}\n`);
});
