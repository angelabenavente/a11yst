export type RegressionVariant = "baseline" | "new" | "resolved" | "severity";

interface VariantPageProps {
  variant: RegressionVariant;
}

export function VariantPage({ variant }: VariantPageProps) {
  const showKnownViolation = variant === "baseline" || variant === "new" || variant === "severity";
  const showNewViolation = variant === "new";
  const showResolvedControl = variant === "resolved";

  return (
    <section>
      <h2>Variant: {variant}</h2>
      <p>
        {variant === "baseline" && "Known button-name violation matches the seeded baseline."}
        {variant === "new" &&
          "Known button-name plus an extra label violation that is not in the baseline."}
        {variant === "resolved" &&
          "The baseline button-name entry is fixed; audits should mark it resolved."}
        {variant === "severity" &&
          "Same button-name element as baseline, but the baseline stored a lower severity."}
      </p>

      {showKnownViolation ? (
        // AXE VIOLATION (button-name): icon-only button on baseline/new/severity routes
        <button type="button" id="regression-action">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <circle cx="8" cy="8" r="7" fill="currentColor" />
          </svg>
        </button>
      ) : null}

      {showResolvedControl ? (
        <button type="button" id="regression-action" aria-label="Continue">
          Continue
        </button>
      ) : null}

      {showNewViolation ? (
        <form style={{ marginTop: "1rem" }}>
          {/* AXE VIOLATION (label): only rendered on the new variant route */}
          <input type="text" id="bonus-input" name="bonus" />
        </form>
      ) : null}
    </section>
  );
}
