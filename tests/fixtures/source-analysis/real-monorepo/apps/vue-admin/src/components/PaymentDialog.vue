<script setup lang="ts">
import CloseIcon from "./CloseIcon.vue";

const dialogTitle = "Payment review";
</script>

<template>
  <div role="dialog" aria-labelledby="payment-title">
    <h2 id="payment-title">{{ dialogTitle }}</h2>
    <button id="close-dialog" type="button" aria-label="Close dialog">
      <CloseIcon />
    </button>
    <button id="shared-submit" type="button">Shared submit</button>
  </div>
</template>

<style scoped>
[role="dialog"] {
  border: 1px solid #ccc;
}
</style>
