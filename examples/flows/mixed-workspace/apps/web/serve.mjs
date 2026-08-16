import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 6341);

const styles = `
  body { max-width: 40rem; margin: 2rem auto; padding: 0 1.25rem; font: 18px/1.5 system-ui; }
  nav { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
  .panel {
    margin-top: 1rem;
    padding: 1rem;
    border: 2px solid #333;
    border-radius: 0.5rem;
    background: #fff;
  }
  .panel[hidden] { display: none !important; }
`;

const script = `
  function wirePanel() {
    const openBtn = document.getElementById("open-panel");
    const closeBtn = document.getElementById("close-panel");
    const panel = document.getElementById("details-panel");
    if (!openBtn || !closeBtn || !panel) return;

    openBtn.addEventListener("click", () => {
      panel.hidden = false;
      panel.removeAttribute("aria-hidden");
      closeBtn.focus();
    });

    closeBtn.addEventListener("click", () => {
      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
      openBtn.focus();
    });
  }

  document.addEventListener("DOMContentLoaded", wirePanel);
`;

const layout = (title, body) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Mixed workspace web</title>
    <style>${styles}</style>
  </head>
  <body>
    <nav aria-label="Primary">
      <a href="/">Home</a>
      <a href="/panel">Panel view</a>
    </nav>
    <main>${body}</main>
    <script>${script}</script>
  </body>
</html>`;

const pages = new Map([
  [
    "/",
    layout(
      "Home",
      `<h1>Mixed workspace web app</h1>
       <p>This web project runs configured flows from a monorepo-style workspace.</p>
       <button id="open-panel" type="button">Show details panel</button>
       <section id="details-panel" class="panel" hidden aria-hidden="true" aria-labelledby="panel-title">
         <h2 id="panel-title">Details panel</h2>
         <p>Focus moves here when the panel opens.</p>
         <button id="close-panel" type="button">Hide details panel</button>
       </section>`,
    ),
  ],
  [
    "/panel",
    layout(
      "Panel view",
      `<h1>Panel view</h1>
       <p>Secondary route in the mixed workspace web fixture.</p>
       <button id="open-panel" type="button">Show details panel</button>
       <section id="details-panel" class="panel" hidden aria-hidden="true" aria-labelledby="panel-title">
         <h2 id="panel-title">Details panel</h2>
         <p>Focus moves here when the panel opens.</p>
         <button id="close-panel" type="button">Hide details panel</button>
       </section>`,
    ),
  ],
]);

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const page = pages.get(url.pathname);
  if (!page) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(page);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`flows/mixed-workspace web listening on http://127.0.0.1:${port}\n`);
});
