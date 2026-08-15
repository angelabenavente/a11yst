import { defineConfig } from "@a11yst/config";

const PORT = process.env.PORT ?? 6320;

export default defineConfig({
  projects: [
    {
      name: "flows-react-checkout",
      rootDir: ".",
      platform: "web",
      framework: "react",
      baseUrl: `http://127.0.0.1:${PORT}`,
      devServer: {
        command: "node serve.mjs",
        url: `http://127.0.0.1:${PORT}`,
        reuseExisting: true,
        startupTimeout: 60_000,
      },
      routes: [{ id: "shop", name: "Shop", path: "/" }],
      profiles: ["default", "keyboard", "large-text", "reduced-motion"],
      viewports: [{ name: "desktop", width: 1440, height: 900 }],
      flows: [
        {
          id: "open-cart",
          name: "Add product and open cart drawer",
          start: "/",
          profiles: ["default", "keyboard", "large-text", "reduced-motion"],
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "button", name: "Add a11yst Mug to cart" },
            },
            {
              action: "checkpoint",
              id: "cart-drawer-open",
              name: "Cart drawer open",
            },
          ],
        },
        {
          id: "checkout-validation-errors",
          name: "Submit checkout with validation errors",
          start: "/",
          profiles: ["default", "keyboard"],
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "button", name: "Add a11yst Mug to cart" },
            },
            {
              action: "click",
              locator: { role: "button", name: "Proceed to checkout" },
            },
            {
              action: "click",
              locator: { role: "button", name: "Place order" },
            },
            {
              action: "checkpoint",
              id: "validation-errors",
              name: "Checkout validation errors visible",
            },
          ],
        },
        {
          id: "successful-checkout",
          name: "Complete checkout successfully",
          start: "/",
          profiles: ["default"],
          viewports: ["desktop"],
          steps: [
            {
              action: "click",
              locator: { role: "button", name: "Add a11yst Tote to cart" },
            },
            {
              action: "click",
              locator: { role: "button", name: "Proceed to checkout" },
            },
            {
              action: "fill",
              locator: { role: "textbox", name: "Full name" },
              value: "Alex a11yst",
            },
            {
              action: "fill",
              locator: { role: "textbox", name: "Email" },
              value: "alex@example.com",
            },
            {
              action: "fill",
              locator: { role: "textbox", name: "Card number" },
              value: "4242 4242 4242 4242",
            },
            {
              action: "click",
              locator: { role: "button", name: "Place order" },
            },
            {
              action: "checkpoint",
              id: "order-confirmation",
              name: "Order confirmation visible",
            },
          ],
        },
      ],
    },
  ],
});
