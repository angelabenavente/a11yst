<script setup lang="ts">
defineProps<{ buttonId: string; label: string }>();
</script>

<template>
  <button :id="buttonId" :aria-label="label" type="button">Pay</button>
</template>
