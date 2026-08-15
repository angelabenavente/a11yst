export type ExpectedLocation = {
  uri: string;
  line: number;
  column: number;
};

export const EXPECTED_LOCATIONS = {
  htmlSubmit: {
    uri: "apps/legacy-html/public/checkout.html",
    line: 17,
    column: 8,
  },
  htmlAmbiguousPrimary: {
    uri: "apps/legacy-html/public/checkout.html",
    line: 20,
    column: 8,
  },
  htmlAmbiguousDuplicate: {
    uri: "apps/legacy-html/public/checkout.html",
    line: 21,
    column: 8,
  },
  htmlImage: {
    uri: "apps/legacy-html/public/checkout.html",
    line: 14,
    column: 8,
  },
  reactSubmit: {
    uri: "apps/react-store/src/components/CheckoutButton.tsx",
    line: 3,
    column: 5,
  },
  reactSharedSubmit: {
    uri: "apps/react-store/src/pages/Checkout.tsx",
    line: 8,
    column: 7,
  },
  nextCheckout: {
    uri: "apps/next-store/src/app/checkout/page.tsx",
    line: 5,
    column: 7,
  },
  nextLayoutShared: {
    uri: "apps/next-store/src/app/checkout/layout.tsx",
    line: 4,
    column: 7,
  },
  nextPageShared: {
    uri: "apps/next-store/src/app/checkout/page.tsx",
    line: 8,
    column: 7,
  },
  vueDialogClose: {
    uri: "apps/vue-admin/src/components/PaymentDialog.vue",
    line: 10,
    column: 5,
  },
  vueSharedSubmit: {
    uri: "apps/vue-admin/src/components/PaymentDialog.vue",
    line: 13,
    column: 5,
  },
  nuxtCheckout: {
    uri: "apps/nuxt-admin/app/pages/checkout.vue",
    line: 4,
    column: 5,
  },
  nuxtLayoutShared: {
    uri: "apps/nuxt-admin/app/layouts/default.vue",
    line: 3,
    column: 5,
  },
  nuxtPageShared: {
    uri: "apps/nuxt-admin/app/pages/checkout.vue",
    line: 7,
    column: 5,
  },
  angularExternalSubmit: {
    uri: "apps/angular-admin/src/app/checkout/checkout.component.html",
    line: 3,
    column: 3,
  },
  angularInlineClose: {
    uri: "apps/angular-admin/src/app/inline-dialog/inline-dialog.component.ts",
    line: 8,
    column: 7,
  },
  partialHtmlSubmit: {
    uri: "apps/legacy-html/public/checkout.html",
    line: 5,
    column: 8,
  },
} as const satisfies Record<string, ExpectedLocation>;

export const SENSITIVE_MARKERS = [
  "A11YST_SECRET_PASSWORD_10K",
  "A11YST_SECRET_TOKEN_10K",
  "A11YST_SECRET_COOKIE_10K",
  "A11YST_SECRET_AUTHORIZATION_10K",
  "A11YST_SECRET_FORM_VALUE_10K",
  "A11YST_SECRET_ROUTE_VALUE_10K",
  "must-not-leak-from-script",
] as const;
