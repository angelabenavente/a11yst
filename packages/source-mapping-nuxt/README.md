# @a11yst/source-mapping-nuxt

Conservative static Nuxt route catalog and source mapping for a11yst.

## Scope

- Detects Nuxt 4 `app/pages/` and Nuxt 3 `pages/` roots within indexed scopes
- Builds route patterns from filenames (static, dynamic, optional, catch-all, route groups)
- Associates pages, parent pages with `<NuxtPage>`, `app.vue`, and default layouts
- Delegates element matching to `@a11yst/source-mapping-vue`
- Does not read `nuxt.config`, `.nuxt`, or Nitro manifests

## Matching

- Route narrowing filters Vue catalog URIs; it never creates candidates alone
- Named layouts require `layoutName` hint
- Error pages require `fileRole: "error"`
- Same route in multiple scopes without hint → `ambiguous`
- Route + tag or filename alone → no candidate

## Limitations

- `.vue` pages only in 10f (other page extensions are counted as unsupported)
- No layers, custom routes, middleware, or i18n/baseURL
- No audit integration in 10f
