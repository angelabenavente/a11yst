import type { SourceMappingCandidate, SourceMappingConfidence, SourceMappingProvenance, SourceMappingSignal } from "@a11yst/types";

function location(uri: string, line: number, column = 1): SourceMappingCandidate["location"] {
  return { uri, region: { start: { line, column } } };
}

export function candidate(input: {
  uri: string;
  line: number;
  column?: number;
  confidence: SourceMappingConfidence;
  provenance: SourceMappingProvenance;
  signals?: SourceMappingSignal[];
  framework?: string;
  adapter?: string;
  component?: string;
  symbol?: string;
}): SourceMappingCandidate {
  const item: SourceMappingCandidate = {
    location: {
      ...location(input.uri, input.line, input.column),
      component: input.component,
      symbol: input.symbol,
    },
    confidence: input.confidence,
    provenance: input.provenance,
    signals: input.signals ?? [],
  };
  if (input.framework) {
    item.framework = input.framework;
  }
  if (input.adapter) {
    item.adapter = input.adapter;
  }
  return item;
}

export function signal(kind: SourceMappingSignal["kind"], matched: boolean, value?: string): SourceMappingSignal {
  return value === undefined ? { kind, matched } : { kind, matched, value };
}

export const reactStrongCandidate = candidate({
  uri: "apps/storefront/src/components/CheckoutButton.tsx",
  line: 18,
  confidence: "high",
  provenance: "selector-match",
  framework: "react",
  adapter: "react-static",
  signals: [
    signal("selector", true, "button#save"),
    signal("component-name", true, "CheckoutButton"),
    signal("accessible-name", true, "Save"),
    signal("element-tag", true, "button"),
    signal("route", true, "/checkout"),
  ],
});

export const reactWeakCandidate = candidate({
  uri: "apps/legacy/public/checkout.html",
  line: 42,
  confidence: "medium",
  provenance: "text-match",
  framework: "html",
  adapter: "html-static",
  signals: [signal("visible-text", true, "Save")],
});

export const sameLocationSelector = candidate({
  uri: "src/Button.tsx",
  line: 20,
  confidence: "high",
  provenance: "selector-match",
  signals: [signal("selector", true, "button#save")],
});

export const sameLocationComponent = candidate({
  uri: "src/Button.tsx",
  line: 20,
  confidence: "high",
  provenance: "component-match",
  signals: [signal("component-name", true, "Button")],
});

export const duplicateSelectorA = candidate({
  uri: "apps/a/Button.tsx",
  line: 10,
  confidence: "high",
  provenance: "selector-match",
  signals: [signal("selector", true, "button#save")],
});

export const duplicateSelectorB = candidate({
  uri: "apps/b/Button.tsx",
  line: 10,
  confidence: "high",
  provenance: "selector-match",
  signals: [signal("selector", true, "button#save")],
});

export const exactCandidateA = candidate({
  uri: "apps/admin/src/app/checkout/checkout.component.html",
  line: 18,
  confidence: "exact",
  provenance: "existing-source-location",
  framework: "angular",
  adapter: "angular-template-static",
  signals: [signal("source-location-present", true)],
});

export const exactCandidateB = candidate({
  uri: "apps/admin/src/app/other/other.component.html",
  line: 5,
  confidence: "exact",
  provenance: "source-map",
  signals: [signal("source-map-resolved", true)],
});

export const lowOnlyCandidate = candidate({
  uri: "apps/admin/src/app/inline.component.ts",
  line: 22,
  confidence: "low",
  provenance: "text-match",
  signals: [signal("visible-text", true, "Continue")],
});

export const mediumStrongCandidate = candidate({
  uri: "apps/admin/src/components/PaymentDialog.vue",
  line: 31,
  confidence: "medium",
  provenance: "component-match",
  framework: "vue",
  adapter: "vue-sfc-static",
  signals: [
    signal("component-name", true, "PaymentDialog"),
    signal("accessible-name", true, "Pay now"),
    signal("attribute", true, "data-testid"),
  ],
});

export const tagOnlyCandidate = candidate({
  uri: "apps/storefront/src/app/checkout/page.tsx",
  line: 27,
  confidence: "medium",
  provenance: "static-source-index",
  framework: "next",
  adapter: "next-static",
  signals: [signal("element-tag", true, "button")],
});

export const routeOnlyCandidate = candidate({
  uri: "apps/admin/app/pages/checkout.vue",
  line: 24,
  confidence: "medium",
  provenance: "static-source-index",
  framework: "nuxt",
  adapter: "nuxt-static",
  signals: [signal("route", true, "/checkout")],
});

export function duplicateAttributeSignals(count: number): SourceMappingSignal[] {
  const signals: SourceMappingSignal[] = [];
  for (let index = 0; index < count; index += 1) {
    signals.push(signal("attribute", true, `data-testid-${index}`));
  }
  return signals;
}
