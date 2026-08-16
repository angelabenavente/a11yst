<template>
  <main>
    <h1>User {{ id }}</h1>
    <nav aria-label="Primary">
      <NuxtLink to="/">Home</NuxtLink>
    </nav>
    <p>Sample dynamic route expanded via routeDiscovery.samples.</p>
  </main>
</template>

<script setup lang="ts">
const route = useRoute();
const id = computed(() => String(route.params.id ?? "unknown"));
</script>
