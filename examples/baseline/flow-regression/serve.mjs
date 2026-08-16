import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 6403);

const styles = `
  body { max-width: 48rem; margin: 2rem auto; padding: 0 1.25rem; font: 18px/1.5 system-ui; }
  nav { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
  a, button { min-height: 2.75rem; font: inherit; }
  .panel, .dialog {
    margin-top: 1.5rem;
    padding: 1.25rem;
    border: 2px solid #333;
    border-radius: 0.5rem;
    background: #fff;
    max-width: 28rem;
  }
  .panel[hidden], .dialog[hidden] { display: none !important; }
  .panel-actions, .dialog-actions { display: flex; gap: 0.75rem; margin-top: 1rem; flex-wrap: wrap; }
  .note { color: #444; font-size: 0.95rem; }
  .cart { margin-top: 1rem; padding: 1rem; border: 1px solid #ccc; border-radius: 0.5rem; }
`;

const script = `
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
    });

    closeBtn.addEventListener("click", () => {
      dialog.hidden = true;
      dialog.setAttribute("aria-hidden", "true");
      closeBtn.focus();
    });
  }

  function wirePartialCheckout(mode) {
    const addBtn = document.getElementById("add-item");
    const cart = document.getElementById("cart");
    const continueBtn = document.getElementById("continue-checkout");
    const confirmation = document.getElementById("confirmation");
    if (!addBtn || !cart || !continueBtn || !confirmation) return;

    if (mode === "short") {
      continueBtn.hidden = true;
      continueBtn.setAttribute("aria-hidden", "true");
    }

    addBtn.addEventListener("click", () => {
      cart.hidden = false;
      cart.removeAttribute("aria-hidden");
    });

    continueBtn.addEventListener("click", () => {
      confirmation.hidden = false;
      confirmation.removeAttribute("aria-hidden");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const scenario = document.body.dataset.scenario;
    if (scenario === "known") {
      wireBadDialog("open-known", "known-panel", "close-known");
    }
    if (scenario === "new") {
      wireBadDialog("open-new", "new-panel", "close-new");
    }
    if (scenario === "resolved") {
      wireAccessibleDialog("open-resolved", "resolved-panel", "close-resolved");
    }
    if (scenario === "partial") {
      wirePartialCheckout(document.body.dataset.mode ?? "full");
    }
  });
`;

const layout = (title, body, scenario = "", mode = "") => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Flow regression fixture</title>
    <style>${styles}</style>
  </head>
  <body${scenario ? ` data-scenario="${scenario}"` : ""}${mode ? ` data-mode="${mode}"` : ""}>
    <nav aria-label="Fixture pages">
      <a href="/">Home</a>
      <a href="/known">Known panel</a>
      <a href="/new">New panel</a>
      <a href="/resolved">Resolved panel</a>
      <a href="/partial">Partial checkout</a>
    </nav>
    <main>${body}</main>
    <script>${script}</script>
  </body>
</html>`;

const pages = new Map([
  [
    "/",
    layout(
      "Flow regression fixtures",
      `<h1>Flow baseline regression fixtures</h1>
       <p class="note">Checkpoint flows for known, new, resolved, and incomplete baseline coverage.</p>
       <ul>
         <li><a href="/known">Known panel</a> — bad dialog focus matches baseline.</li>
         <li><a href="/new">New panel</a> — bad dialog plus new label at checkpoint.</li>
         <li><a href="/resolved">Resolved panel</a> — accessible dialog fixes baseline finding.</li>
         <li><a href="/partial">Partial checkout</a> — confirmation checkpoint for incomplete flows.</li>
       </ul>`,
    ),
  ],
  [
    "/known",
    layout(
      "Known panel",
      `<h1>Known panel</h1>
       <p class="note">Opening leaves focus on the trigger — matches baseline dialog-focus-entry.</p>
       <button id="open-known" type="button">Open known panel</button>
       <div id="known-panel" class="dialog" role="dialog" aria-modal="true" aria-labelledby="known-title" hidden aria-hidden="true">
         <h2 id="known-title">Known panel</h2>
         <p>Focus stays on the opener when this panel opens.</p>
         <div class="dialog-actions">
           <button id="close-known" type="button">Close</button>
         </div>
       </div>`,
      "known",
    ),
  ],
  [
    "/new",
    layout(
      "New panel",
      `<h1>New panel</h1>
       <p class="note">Same bad focus as baseline plus an unlabeled field that is not in the baseline.</p>
       <button id="open-new" type="button">Open new panel</button>
       <div id="new-panel" class="dialog" role="dialog" aria-modal="true" aria-labelledby="new-title" hidden aria-hidden="true">
         <h2 id="new-title">New panel</h2>
         <input type="text" id="bonus-field" name="bonus" />
         <div class="dialog-actions">
           <button id="close-new" type="button">Close</button>
         </div>
       </div>`,
      "new",
    ),
  ],
  [
    "/resolved",
    layout(
      "Resolved panel",
      `<h1>Resolved panel</h1>
       <p class="note">Accessible dialog behavior resolves the baseline dialog-focus-entry entry.</p>
       <button id="open-resolved" type="button">Open resolved panel</button>
       <div id="resolved-panel" class="dialog" role="dialog" aria-modal="true" aria-labelledby="resolved-title" hidden aria-hidden="true">
         <h2 id="resolved-title">Resolved panel</h2>
         <p>Focus moves into the dialog on open.</p>
         <div class="dialog-actions">
           <button id="close-resolved" type="button">Close</button>
         </div>
       </div>`,
      "resolved",
    ),
  ],
  [
    "/partial",
    layout(
      "Partial checkout",
      `<h1>Partial checkout</h1>
       <p class="note">Full flow reaches confirmation with a label violation. Short flow stops at cart.</p>
       <button id="add-item" type="button">Add sample item</button>
       <div id="cart" class="cart" hidden aria-hidden="true">
         <p>Cart ready with one sample item.</p>
         <button id="continue-checkout" type="button">Continue to confirmation</button>
       </div>
       <div id="confirmation" class="panel" hidden aria-hidden="true">
         <h2>Confirmation</h2>
         <input type="email" id="confirm-email" name="confirm-email" />
       </div>`,
      "partial",
      "full",
    ),
  ],
]);

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const mode = url.searchParams.get("mode");
  if (url.pathname === "/partial" && mode === "short") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      layout(
        "Partial checkout (short)",
        `<h1>Partial checkout (short mode)</h1>
         <p class="note">Continue is hidden so only the cart-ready checkpoint can run.</p>
         <button id="add-item" type="button">Add sample item</button>
         <div id="cart" class="cart" hidden aria-hidden="true">
           <p>Cart ready with one sample item.</p>
           <button id="continue-checkout" type="button" hidden aria-hidden="true">Continue to confirmation</button>
         </div>
         <div id="confirmation" class="panel" hidden aria-hidden="true">
           <h2>Confirmation</h2>
           <input type="email" id="confirm-email" name="confirm-email" />
         </div>`,
        "partial",
        "short",
      ),
    );
    return;
  }

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
  process.stdout.write(`baseline/flow-regression listening on http://127.0.0.1:${port}\n`);
});
