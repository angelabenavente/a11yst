import type {
  RecommendationAction,
  RecommendationApplicability,
  RecommendationExample,
  RecommendationTarget,
  RecommendationVerification,
} from "@a11yst/types";
import type { NormalizedFramework } from "./framework.js";
import { exampleLanguageForFramework, labelAttributeForFramework } from "./framework.js";

export type RecipeContext = {
  framework: NormalizedFramework;
  target: RecommendationTarget;
  elementTag?: string;
  iconOnly?: boolean;
};

export type RecommendationRecipe = {
  ruleId: string;
  aliases?: string[];
  title: string;
  summary: string;
  rationale: string;
  defaultApplicability: RecommendationApplicability;
  manualReview?: boolean;
  buildActions(context: RecipeContext): RecommendationAction[];
  buildVerification(context: RecipeContext): RecommendationVerification[];
  buildExamples(context: RecipeContext): RecommendationExample[];
  buildCaveats(context: RecipeContext): string[];
};

function rerunAuditVerification(): RecommendationVerification {
  return {
    id: "verification.rerun-audit",
    title: "Rerun automated audit",
    description: "Run the accessibility audit again after changes and review remaining findings.",
    mode: "automated",
  };
}

function manualVerification(id: string, title: string, description: string, mode: RecommendationVerification["mode"]): RecommendationVerification {
  return { id, title, description, mode };
}

function baseCaveats(context: RecipeContext): string[] {
  const caveats = [
    "Automated results do not establish WCAG conformance.",
    "Verify the change in the rendered application and with appropriate manual testing.",
  ];
  if (context.target.status === "ambiguous") {
    caveats.push("The source location is ambiguous. Review the listed candidate locations before editing code.");
  }
  if (context.target.status === "unmapped") {
    caveats.push("No source file was selected. Use the route and element context to locate the implementation.");
  }
  if (context.target.sourceConfidence === "low") {
    caveats.push("The source location has low confidence and should be verified before editing.");
  }
  return caveats.sort((left, right) => left.localeCompare(right));
}

function buttonExamples(context: RecipeContext): RecommendationExample[] {
  const language = exampleLanguageForFramework(context.framework);
  const examples: RecommendationExample[] = [{
    language,
    title: "Provide an accessible name",
    code: language === "html"
      ? '<button aria-label="Open cart">\n  <svg aria-hidden="true">...</svg>\n</button>'
      : language === "vue"
        ? '<button aria-label="Open cart">\n  <CartIcon aria-hidden="true" />\n</button>'
        : language === "angular"
          ? '<button aria-label="Open cart">\n  <app-cart-icon aria-hidden="true"></app-cart-icon>\n</button>'
          : '<button aria-label="Open cart">\n  <CartIcon aria-hidden="true" />\n</button>',
    generic: true,
  }];
  return examples;
}

const buttonNameRecipe: RecommendationRecipe = {
  ruleId: "button-name",
  title: "Give the button an accessible name",
  summary: "Ensure the button exposes a descriptive accessible name to assistive technologies.",
  rationale: "Buttons need a name that describes their action or purpose.",
  defaultApplicability: "high",
  buildActions: () => [
    { id: "button-name.prefer-visible-text", kind: "content-change", title: "Prefer visible text", description: "Use visible text that describes the action when possible." },
    { id: "button-name.add-accessible-name", kind: "code-change", title: "Add an accessible name", description: "For icon-only buttons, add aria-label or aria-labelledby with descriptive text." },
    { id: "button-name.hide-decorative-icon", kind: "code-change", title: "Hide decorative icons", description: "Mark decorative icons as hidden from assistive technologies." },
  ],
  buildVerification: () => [
    rerunAuditVerification(),
    manualVerification("button-name.keyboard", "Test keyboard activation", "Activate the button with keyboard and confirm focus order.", "keyboard"),
    manualVerification("button-name.screen-reader", "Check exposed name", "Inspect the name announced by a screen reader.", "screen-reader"),
  ],
  buildExamples: buttonExamples,
  buildCaveats: baseCaveats,
};

const linkNameRecipe: RecommendationRecipe = {
  ruleId: "link-name",
  title: "Give the link an accessible name",
  summary: "Ensure the link text or accessible name describes the destination or action.",
  rationale: "Links should communicate purpose without relying on surrounding context alone.",
  defaultApplicability: "high",
  buildActions: () => [
    { id: "link-name.visible-text", kind: "content-change", title: "Use descriptive link text", description: "Provide specific link text instead of generic phrases such as click here." },
    { id: "link-name.icon-link", kind: "code-change", title: "Name icon-only links", description: "Add aria-label when the link content is only an icon." },
  ],
  buildVerification: () => [
    rerunAuditVerification(),
    manualVerification("link-name.keyboard", "Navigate by keyboard", "Activate the link with keyboard and confirm destination context.", "keyboard"),
    manualVerification("link-name.screen-reader", "Review link list", "Check how the link appears in screen-reader link lists.", "screen-reader"),
  ],
  buildExamples: (context) => [{
    language: exampleLanguageForFramework(context.framework),
    title: "Descriptive link text",
    code: '<a href="/account">View account settings</a>',
    generic: true,
  }],
  buildCaveats: baseCaveats,
};

const imageAltRecipe: RecommendationRecipe = {
  ruleId: "image-alt",
  title: "Review image alternative text",
  summary: "Determine whether the image is informative, decorative, or functional and provide appropriate alternative text.",
  rationale: "Alternative text depends on the image purpose and surrounding context.",
  defaultApplicability: "medium",
  manualReview: true,
  buildActions: () => [
    { id: "image-alt.informative", kind: "content-change", title: "Informative images", description: "Provide alt text that conveys the purpose or meaning of the image." },
    { id: "image-alt.decorative", kind: "code-change", title: "Decorative images", description: "Use an empty alt attribute when the image is purely decorative." },
    { id: "image-alt.functional", kind: "content-change", title: "Functional images", description: "When the image is part of a control, name the action rather than appearance." },
  ],
  buildVerification: () => [
    rerunAuditVerification(),
    manualVerification("image-alt.purpose", "Confirm image purpose", "Decide whether the image is decorative, informative, or functional.", "manual"),
    manualVerification("image-alt.screen-reader", "Verify announcement", "Check how assistive technologies announce the image.", "screen-reader"),
  ],
  buildExamples: () => [
    { language: "html", title: "Informative image", code: '<img alt="Quarterly revenue increased" src="chart.png" />', generic: true },
    { language: "html", title: "Decorative image", code: '<img alt="" src="divider.png" />', generic: true },
  ],
  buildCaveats: baseCaveats,
};

const labelRecipe: RecommendationRecipe = {
  ruleId: "label",
  title: "Associate a visible label with the control",
  summary: "Ensure form controls have a programmatically associated label.",
  rationale: "Labels help users understand the purpose of inputs and select the correct field.",
  defaultApplicability: "high",
  buildActions: (context) => {
    const labelAttr = labelAttributeForFramework(context.framework);
    return [
      { id: "label.visible-label", kind: "code-change", title: "Use a visible label", description: `Associate a <label ${labelAttr}="field-id"> with the control id.` },
      { id: "label.no-placeholder-only", kind: "design-review", title: "Avoid placeholder-only labels", description: "Do not rely on placeholder text as the only label." },
      { id: "label.aria-fallback", kind: "code-change", title: "Accessible name fallback", description: "Use aria-label or aria-labelledby only when a visible label is not viable." },
    ];
  },
  buildVerification: () => [
    rerunAuditVerification(),
    manualVerification("label.name", "Inspect accessible name", "Verify the control name is exposed to assistive technologies.", "screen-reader"),
    manualVerification("label.errors", "Review error association", "Confirm error messages are associated with the field when present.", "manual"),
  ],
  buildExamples: (context) => {
    const labelAttr = labelAttributeForFramework(context.framework);
    const selfClose = context.framework === "react" || context.framework === "next" ? " />" : ">";
    return [{
      language: exampleLanguageForFramework(context.framework),
      title: "Label association",
      code: `<label ${labelAttr}="email">Email</label>\n<input id="email" type="email"${selfClose}`,
      generic: true,
    }];
  },
  buildCaveats: baseCaveats,
};

function ariaFieldRecipe(ruleId: string, title: string): RecommendationRecipe {
  return {
    ruleId,
    title,
    summary: "Ensure the field has an accessible name and appropriate native semantics.",
    rationale: "Custom inputs and ARIA fields require explicit naming and valid roles.",
    defaultApplicability: "medium",
    buildActions: () => [
      { id: `${ruleId}.native-first`, kind: "design-review", title: "Prefer native HTML", description: "Use native form controls when possible before adding ARIA." },
      { id: `${ruleId}.accessible-name`, kind: "code-change", title: "Provide accessible name", description: "Associate a label, aria-label, or aria-labelledby with the field." },
    ],
    buildVerification: () => [
      rerunAuditVerification(),
      manualVerification(`${ruleId}.screen-reader`, "Verify field name", "Confirm the field name is announced correctly.", "screen-reader"),
    ],
    buildExamples: (context) => [{
      language: exampleLanguageForFramework(context.framework),
      title: "Named field",
      code: '<label for="name">Name</label>\n<input id="name" type="text" />',
      generic: true,
    }],
    buildCaveats: baseCaveats,
  };
}

const ariaDialogRecipe: RecommendationRecipe = {
  ruleId: "aria-dialog-name",
  title: "Name the dialog and review modal behavior",
  summary: "Provide a dialog name and verify focus management when the dialog opens and closes.",
  rationale: "Dialogs require an accessible name and careful focus handling.",
  defaultApplicability: "medium",
  manualReview: true,
  buildActions: () => [
    { id: "aria-dialog-name.labelledby", kind: "code-change", title: "Use visible heading", description: "Prefer aria-labelledby referencing the dialog heading when available." },
    { id: "aria-dialog-name.label", kind: "code-change", title: "Provide aria-label", description: "Use aria-label when no suitable visible heading exists." },
    { id: "aria-dialog-name.focus", kind: "manual-test", title: "Review focus behavior", description: "Verify initial focus, focus containment, and focus return on close." },
  ],
  buildVerification: () => [
    rerunAuditVerification(),
    manualVerification("aria-dialog-name.open", "Open with keyboard", "Open the dialog using keyboard and review initial focus.", "keyboard"),
    manualVerification("aria-dialog-name.close", "Close and return focus", "Close the dialog and verify focus returns to the triggering control.", "keyboard"),
    manualVerification("aria-dialog-name.name", "Verify dialog name", "Confirm the dialog name is announced.", "screen-reader"),
  ],
  buildExamples: () => [{
    language: "html",
    title: "Named dialog",
    code: '<div role="dialog" aria-labelledby="dialog-title">\n  <h2 id="dialog-title">Confirm order</h2>\n</div>',
    generic: true,
  }],
  buildCaveats: (context) => [...baseCaveats(context), "Naming the dialog does not guarantee complete modal behavior."].sort((a, b) => a.localeCompare(b)),
};

const htmlHasLangRecipe: RecommendationRecipe = {
  ruleId: "html-has-lang",
  title: "Set the document language",
  summary: "Add a valid lang attribute on the html element.",
  rationale: "Document language helps assistive technologies use correct pronunciation and language rules.",
  defaultApplicability: "high",
  buildActions: () => [
    { id: "html-has-lang.lang", kind: "configuration-review", title: "Add lang attribute", description: "Set lang on the html element to the primary page language." },
  ],
  buildVerification: () => [rerunAuditVerification(), manualVerification("html-has-lang.verify", "Verify language", "Confirm the declared language matches the page content.", "manual")],
  buildExamples: () => [{ language: "html", title: "Document language", code: '<html lang="en">', generic: true }],
  buildCaveats: baseCaveats,
};

const documentTitleRecipe: RecommendationRecipe = {
  ruleId: "document-title",
  title: "Provide a descriptive document title",
  summary: "Ensure the page has a concise, descriptive title element.",
  rationale: "The document title helps users orient themselves across pages and tabs.",
  defaultApplicability: "high",
  buildActions: () => [
    { id: "document-title.set", kind: "content-change", title: "Set page title", description: "Provide a title element that describes the page purpose." },
  ],
  buildVerification: () => [rerunAuditVerification(), manualVerification("document-title.verify", "Review title", "Confirm the title is unique and meaningful in context.", "manual")],
  buildExamples: () => [{ language: "html", title: "Page title", code: "<title>Checkout - Example Store</title>", generic: true }],
  buildCaveats: baseCaveats,
};

const colorContrastRecipe: RecommendationRecipe = {
  ruleId: "color-contrast",
  title: "Review text and control contrast",
  summary: "Review foreground and background combinations across states without assuming a single fix color.",
  rationale: "Contrast depends on palette, theme, and interactive states.",
  defaultApplicability: "medium",
  manualReview: true,
  buildActions: () => [
    { id: "color-contrast.states", kind: "design-review", title: "Review all states", description: "Check default, hover, focus, disabled, and error states." },
    { id: "color-contrast.themes", kind: "design-review", title: "Review themes", description: "Verify contrast in light, dark, and high-contrast themes if supported." },
  ],
  buildVerification: () => [
    rerunAuditVerification(),
    manualVerification("color-contrast.visual", "Visual review", "Inspect real rendered colors in the application.", "visual"),
    manualVerification("color-contrast.zoom", "Check zoom", "Review readability at increased zoom levels.", "visual"),
  ],
  buildExamples: () => [],
  buildCaveats: (context) => [...baseCaveats(context), "Gradients, transparency, and images may require manual measurement."].sort((a, b) => a.localeCompare(b)),
};

const headingOrderRecipe: RecommendationRecipe = {
  ruleId: "heading-order",
  title: "Review heading structure",
  summary: "Ensure headings reflect meaningful document structure rather than visual styling alone.",
  rationale: "Heading order supports navigation and comprehension.",
  defaultApplicability: "medium",
  manualReview: true,
  buildActions: () => [
    { id: "heading-order.structure", kind: "design-review", title: "Review hierarchy", description: "Organize headings by meaning, not only by visual size." },
    { id: "heading-order.no-style-only", kind: "design-review", title: "Avoid style-only headings", description: "Do not use heading elements solely for appearance." },
  ],
  buildVerification: () => [
    rerunAuditVerification(),
    manualVerification("heading-order.navigate", "Navigate by headings", "Use heading navigation in a screen reader or browser tools.", "screen-reader"),
  ],
  buildExamples: () => [],
  buildCaveats: baseCaveats,
};

const landmarkOneMainRecipe: RecommendationRecipe = {
  ruleId: "landmark-one-main",
  title: "Provide one primary main region",
  summary: "Ensure the page exposes a single identifiable main landmark.",
  rationale: "A main landmark helps users skip repeated content and reach primary content quickly.",
  defaultApplicability: "high",
  buildActions: () => [
    { id: "landmark-one-main.main", kind: "code-change", title: "Use main landmark", description: "Prefer a single main element or role=\"main\" for primary content." },
    { id: "landmark-one-main.multiple", kind: "design-review", title: "Avoid multiple mains", description: "Review layouts and modals that may expose more than one main region." },
  ],
  buildVerification: () => [
    rerunAuditVerification(),
    manualVerification("landmark-one-main.landmarks", "Review landmarks", "Navigate landmarks with a screen reader.", "screen-reader"),
  ],
  buildExamples: () => [{ language: "html", title: "Main landmark", code: "<main>...</main>", generic: true }],
  buildCaveats: baseCaveats,
};

const duplicateIdAriaRecipe: RecommendationRecipe = {
  ruleId: "duplicate-id-aria",
  title: "Ensure referenced IDs are unique",
  summary: "Use unique IDs and verify ARIA and label references still point to the intended element.",
  rationale: "Duplicate IDs break label and ARIA reference relationships.",
  defaultApplicability: "high",
  buildActions: () => [
    { id: "duplicate-id-aria.unique", kind: "code-change", title: "Make IDs unique", description: "Ensure each referenced id appears once in the rendered document." },
    { id: "duplicate-id-aria.references", kind: "manual-test", title: "Verify references", description: "Check aria-labelledby, aria-describedby, aria-controls, and label for attributes." },
  ],
  buildVerification: () => [rerunAuditVerification(), manualVerification("duplicate-id-aria.verify", "Verify references", "Confirm each reference resolves to the correct element.", "manual")],
  buildExamples: () => [{ language: "html", title: "Unique id reference", code: '<label for="email">Email</label>\n<input id="email" type="email" />', generic: true }],
  buildCaveats: baseCaveats,
};

const ariaValidAttrRecipe: RecommendationRecipe = {
  ruleId: "aria-valid-attr-value",
  title: "Review ARIA attribute values",
  summary: "Use valid ARIA values for the element role and prefer native HTML semantics when possible.",
  rationale: "Invalid ARIA values can misrepresent state to assistive technologies.",
  defaultApplicability: "medium",
  manualReview: true,
  buildActions: () => [
    { id: "aria-valid-attr-value.native", kind: "design-review", title: "Prefer native HTML", description: "Use native elements and states before adding ARIA." },
    { id: "aria-valid-attr-value.spec", kind: "manual-test", title: "Validate allowed values", description: "Confirm attribute values match the specification for the role and state." },
  ],
  buildVerification: () => [rerunAuditVerification(), manualVerification("aria-valid-attr-value.at", "Test with assistive tech", "Verify the control behaves as intended.", "screen-reader")],
  buildExamples: () => [],
  buildCaveats: baseCaveats,
};

const ariaRequiredAttrRecipe: RecommendationRecipe = {
  ruleId: "aria-required-attr",
  title: "Provide required ARIA attributes",
  summary: "Ensure required ARIA attributes are present for the chosen role.",
  rationale: "Some ARIA roles require specific attributes to convey meaning correctly.",
  defaultApplicability: "medium",
  manualReview: true,
  buildActions: () => [
    { id: "aria-required-attr.native", kind: "design-review", title: "Prefer native HTML", description: "Use native semantics instead of unnecessary ARIA roles." },
    { id: "aria-required-attr.required", kind: "code-change", title: "Add required attributes", description: "Provide required attributes for the role without inventing unsupported values." },
  ],
  buildVerification: () => [rerunAuditVerification(), manualVerification("aria-required-attr.verify", "Verify role behavior", "Test the component with assistive technologies.", "screen-reader")],
  buildExamples: () => [],
  buildCaveats: baseCaveats,
};

export const RECIPE_DEFINITIONS: RecommendationRecipe[] = [
  buttonNameRecipe,
  linkNameRecipe,
  imageAltRecipe,
  labelRecipe,
  ariaFieldRecipe("aria-input-field-name", "Give the input field an accessible name"),
  ariaDialogRecipe,
  htmlHasLangRecipe,
  documentTitleRecipe,
  colorContrastRecipe,
  headingOrderRecipe,
  landmarkOneMainRecipe,
  duplicateIdAriaRecipe,
  ariaValidAttrRecipe,
  ariaRequiredAttrRecipe,
];
