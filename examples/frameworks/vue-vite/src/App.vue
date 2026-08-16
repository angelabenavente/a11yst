<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div>
    <header>
      <h1>Framework Vue + Vite</h1>
      <nav aria-label="Primary">
        <RouterLink to="/">Home</RouterLink>
        |
        <RouterLink to="/issues">Issues</RouterLink>
      </nav>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>
