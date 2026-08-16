<template>
  <main>
    <h1>Vue menu flow fixtures</h1>
    <p class="note">Two dropdown menu scenarios for a11yst flow checkpoints.</p>
    <ul>
      <li>
        <RouterLink to="/accessible">Accessible menu</RouterLink> — Escape closes the menu and
        returns focus to the trigger.
      </li>
      <li>
        <RouterLink to="/bad">Bad menu</RouterLink> — Escape does not close the menu or restore
        focus.
      </li>
    </ul>
  </main>
</template>
