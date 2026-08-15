import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 6311);

const styles = `
  body { max-width: 48rem; margin: 2rem auto; padding: 0 1.25rem; font: 18px/1.5 system-ui; }
  nav { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
  a, button { min-height: 2.75rem; font: inherit; }
  .dialog {
    margin-top: 1.5rem;
    padding: 1.25rem;
    border: 2px solid #333;
    border-radius: 0.5rem;
    background: #fff;
    max-width: 28rem;
  }
  .dialog[hidden] { display: none !important; }
  .dialog-actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
  .note { color: #444; font-size: 0.95rem; }
`;

const dialogScript = `
  function wireAccessibleDialog(openId, dialogId, closeId) {
    const openBtn = document.getElementById(openId);
    const dialog = document.getElementById(dialogId);
    const closeBtn = document.getElementById(closeId);
    if (!openBtn || !dialog || !closeBtn) return;

    openBtn.addEventListener("click", () => {
      dialog.hidden = false;
      dialog.removeAttribute("aria-hidden");
      closeBtn.focus();
    });

    closeBtn.addEventListener("click", () => {
      dialog.hidden = true;
      dialog.setAttribute("aria-hidden", "true");
      openBtn.focus();
    });
  }

  function wireBadDialog(openId, dialogId, closeId) {
    const openBtn = document.getElementById(openId);
    const dialog = document.getElementById(dialogId);
    const closeBtn = document.getElementById(closeId);
    if (!openBtn || !dialog || !closeBtn) return;

    openBtn.addEventListener("click", () => {
      dialog.hidden = false;
      dialog.removeAttribute("aria-hidden");
      // Intentionally keep focus on the trigger for dialog-focus-entry.
    });

    closeBtn.addEventListener("click", () => {
      dialog.hidden = true;
      dialog.setAttribute("aria-hidden", "true");
      // Intentionally skip focus return for dialog-focus-return-review.
      closeBtn.focus();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.scenario === "accessible") {
      wireAccessibleDialog("open-accessible", "accessible-dialog", "close-accessible");
    }
    if (document.body.dataset.scenario === "bad") {
      wireBadDialog("open-bad", "bad-dialog", "close-bad");
    }
  });
`;

const layout = (title, body, scenario) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | HTML dialog flow fixture</title>
    <style>${styles}</style>
  </head>
  <body${scenario ? ` data-scenario="${scenario}"` : ""}>
    <nav aria-label="Fixture pages">
      <a href="/">Home</a>
      <a href="/accessible">Accessible dialog</a>
      <a href="/bad">Bad dialog</a>
    </nav>
    <main>${body}</main>
    <script>${dialogScript}</script>
  </body>
</html>`;

const pages = new Map([
  [
    "/",
    layout(
      "Dialog fixtures",
      `<h1>Dialog flow fixtures</h1>
       <p class="note">Two intentional dialog scenarios for a11yst flow checkpoints.</p>
       <ul>
         <li><a href="/accessible">Accessible dialog</a> — focus enters the dialog and returns to the trigger.</li>
         <li><a href="/bad">Bad dialog</a> — focus stays on the trigger when the dialog opens.</li>
       </ul>`,
      "",
    ),
  ],
  [
    "/accessible",
    layout(
      "Accessible dialog",
      `<h1>Accessible dialog</h1>
       <p class="note">Opening moves focus to the first control inside the dialog. Closing restores focus to the trigger.</p>
       <button id="open-accessible" type="button">Open accessible dialog</button>
       <div
         id="accessible-dialog"
         class="dialog"
         role="dialog"
         aria-modal="true"
         aria-labelledby="accessible-title"
         hidden
         aria-hidden="true"
       >
         <h2 id="accessible-title">Accessible dialog</h2>
         <p>Focus should land here when this dialog opens.</p>
         <div class="dialog-actions">
           <button id="close-accessible" type="button">Close</button>
         </div>
       </div>`,
      "accessible",
    ),
  ],
  [
    "/bad",
    layout(
      "Bad dialog",
      `<h1>Bad dialog focus</h1>
       <p class="note">Opening leaves focus on the trigger. Closing does not restore focus to the opener.</p>
       <button id="open-bad" type="button">Open bad dialog</button>
       <div
         id="bad-dialog"
         class="dialog"
         role="dialog"
         aria-modal="true"
         aria-labelledby="bad-title"
         hidden
         aria-hidden="true"
       >
         <h2 id="bad-title">Bad dialog</h2>
         <p>Focus incorrectly remains on the page behind this dialog.</p>
         <div class="dialog-actions">
           <button id="close-bad" type="button">Close</button>
         </div>
       </div>`,
      "bad",
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
  process.stdout.write(`flows/html-dialog listening on http://127.0.0.1:${port}\n`);
});
