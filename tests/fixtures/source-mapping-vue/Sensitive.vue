<template>
  <input
    name="password"
    value="Password123!"
    data-testid="password-field"
  />
  <input name="token" value="Bearer secret-token" />
  <input name="cookie" value="session=abc" />
  <input name="authorization" value="Basic xyz" />
  <input name="email" value="user@example.com" />
  <a href="javascript:alert(1)">Click</a>
  <button @click="handler">Save</button>
  <div v-html="html"></div>
</template>

<script setup lang="ts">
const html = "<script>alert(1)</script>";
function handler() {}
</script>
