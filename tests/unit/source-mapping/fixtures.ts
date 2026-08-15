import type {
  ExistingSourceLocation,
  SourceMappingCandidate,
  SourceMappingSignal,
} from "@a11yst/source-mapping";
import { createSourceMappingCandidate } from "@a11yst/source-mapping";

export const existingHtmlSourceLocation: ExistingSourceLocation = {
  uri: "apps/legacy/public/checkout.html",
  startLine: 18,
  startColumn: 5,
};

export function buildReactComponentCandidate(
  overrides: Partial<SourceMappingCandidate> = {},
): SourceMappingCandidate {
  const base = createSourceMappingCandidate({
    uri: "apps/storefront/src/components/CheckoutButton.tsx",
    region: { start: { line: 42, column: 3 } },
    confidence: "high",
    provenance: "component-match",
    signals: [
      { kind: "component-name", matched: true, value: "CheckoutButton" },
      { kind: "accessible-name", matched: true, value: "Complete purchase" },
    ],
    framework: "react",
  });
  return { ...base, ...overrides };
}

export function buildNextJsCandidate(
  overrides: Partial<SourceMappingCandidate> = {},
): SourceMappingCandidate {
  const base = createSourceMappingCandidate({
    uri: "apps/storefront/src/app/checkout/page.tsx",
    region: { start: { line: 71, column: 9 } },
    confidence: "exact",
    provenance: "framework-compiler",
    signals: [{ kind: "framework-metadata", matched: true, value: "next-app-router" }],
    framework: "next",
  });
  return { ...base, ...overrides };
}

export function buildVueCandidate(
  overrides: Partial<SourceMappingCandidate> = {},
): SourceMappingCandidate {
  const base = createSourceMappingCandidate({
    uri: "apps/admin/src/components/PaymentDialog.vue",
    region: { start: { line: 24, column: 7 } },
    confidence: "medium",
    provenance: "text-match",
    signals: [{ kind: "visible-text", matched: true, value: "Confirm payment" }],
    framework: "vue",
  });
  return { ...base, ...overrides };
}

export function buildAngularCandidate(
  overrides: Partial<SourceMappingCandidate> = {},
): SourceMappingCandidate {
  const base = createSourceMappingCandidate({
    uri: "apps/admin/src/app/payment/payment.component.html",
    region: { start: { line: 16, column: 3 } },
    confidence: "medium",
    provenance: "selector-match",
    signals: [{ kind: "selector", matched: true, value: "button.submit" }],
    framework: "angular",
  });
  return { ...base, ...overrides };
}

export function buildFlowCheckpointCandidate(): SourceMappingCandidate {
  return createSourceMappingCandidate({
    uri: "apps/storefront/src/flows/checkout.ts",
    region: { start: { line: 12, column: 1 } },
    confidence: "high",
    provenance: "static-source-index",
    signals: [
      { kind: "flow", matched: true, value: "checkout" },
      { kind: "checkpoint", matched: true, value: "payment-step" },
    ],
  });
}

export function buildDuplicateCandidate(): SourceMappingCandidate {
  return createSourceMappingCandidate({
    uri: "apps/storefront/src/components/CheckoutButton.tsx",
    region: { start: { line: 42, column: 3 } },
    confidence: "high",
    provenance: "component-match",
    signals: [{ kind: "attribute", matched: true, value: "type=submit" }],
  });
}

export function buildConflictingExactCandidateA(): SourceMappingCandidate {
  return createSourceMappingCandidate({
    uri: "apps/storefront/src/components/CheckoutButton.tsx",
    region: { start: { line: 42, column: 3 } },
    confidence: "exact",
    provenance: "source-map",
    signals: [{ kind: "source-map-resolved", matched: true }],
  });
}

export function buildConflictingExactCandidateB(): SourceMappingCandidate {
  return createSourceMappingCandidate({
    uri: "apps/storefront/src/components/CheckoutButton.tsx",
    region: { start: { line: 48, column: 1 } },
    confidence: "exact",
    provenance: "framework-compiler",
    signals: [{ kind: "framework-metadata", matched: true, value: "react" }],
  });
}

export const unsafeAbsolutePathLocation: ExistingSourceLocation = {
  uri: "/etc/passwd",
  startLine: 1,
};

export const traversalPathLocation: ExistingSourceLocation = {
  uri: "../secret/config.ts",
  startLine: 3,
};

export const invalidLineLocation: ExistingSourceLocation = {
  uri: "src/a.ts",
  startLine: 0,
};

export const hostileSignalMetadata: SourceMappingSignal[] = [
  { kind: "visible-text", matched: true, value: "<button onclick=\"steal()\">Pay</button>" },
  { kind: "attribute", matched: true, value: "password=SuperSecret123!" },
  { kind: "attribute", matched: true, value: "token=eyJhbGciOiJIUzI1NiJ9.payload.sig" },
  { kind: "attribute", matched: true, value: "cookie=session=abc123" },
  { kind: "attribute", matched: true, value: "authorization=Bearer abc.def.ghi" },
  { kind: "attribute", matched: true, value: "form-value=user-input" },
  { kind: "route", matched: true, value: "/Users/dev/project/src/Button.tsx" },
];
