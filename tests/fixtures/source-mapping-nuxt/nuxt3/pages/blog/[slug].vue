<template>
  <article>
    <h1>{{ slug }}</h1>
  </article>
</template>

<script setup lang="ts">
defineProps<{ slug: string }>();
</script>
