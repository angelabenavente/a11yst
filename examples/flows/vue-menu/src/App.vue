<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div>
    <header>
      <nav aria-label="Fixture pages">
        <RouterLink to="/">Home</RouterLink>
        |
        <RouterLink to="/accessible">Accessible menu</RouterLink>
        |
        <RouterLink to="/bad">Bad menu</RouterLink>
      </nav>
    </header>
    <RouterView />
  </div>
</template>

<style>
body {
  margin: 1.5rem;
  font: 18px/1.5 system-ui, sans-serif;
}

nav {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

a {
  color: inherit;
}

.menu-panel {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border: 2px solid #333;
  border-radius: 0.5rem;
  background: #fff;
  max-width: 16rem;
  list-style: none;
}

.menu-panel li + li {
  margin-top: 0.5rem;
}

.note {
  color: #444;
  font-size: 0.95rem;
}
</style>
