export function BrokenPage() {
  return (
    <section>
      <h2>Broken</h2>
      <p>
        This route contains a documented, intentional accessibility
        violation used to verify that a11yst's Phase 3 browser audit engine
        detects issues on client-side rendered routes, not just the initial
        HTML.
      </p>
      {/* AXE VIOLATION (button-name): icon-only button has no text content,
          aria-label, aria-labelledby, or title, so it has no accessible name. */}
      <button type="button">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <rect x="2" y="2" width="12" height="12" fill="currentColor" />
        </svg>
      </button>
    </section>
  );
}
