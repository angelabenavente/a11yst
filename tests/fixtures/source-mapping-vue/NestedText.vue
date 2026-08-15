<template>
  <button>
    <span>Place</span>
    <strong>order</strong>
  </button>
  <button>{{ label }}</button>
  <button v-text="label" />
  <button v-html="content" />
  <img alt="Product photo" src="/photo.png" />
</template>

<script setup lang="ts">
const label = "dynamic";
const content = "<b>x</b>";
</script>
