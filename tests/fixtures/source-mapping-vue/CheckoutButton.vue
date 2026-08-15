<template>
  <button
    id="submit-order"
    class="primary-btn"
    aria-label="Place order"
    :aria-describedby="descriptionId"
    data-testid="checkout-submit"
    :disabled="false"
    v-bind="attrs"
    @click="submit"
  >
    Place order
  </button>
</template>

<script setup lang="ts">
const attrs = {};
const descriptionId = "order-help";
function submit() {}
</script>

<style scoped>
.primary-btn { color: blue; }
</style>
