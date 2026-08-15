<template>
  <form>
    <CheckoutButton />
    <checkout-button />
    <button>Cancel</button>
    <button>Cancel</button>
    <input id="email" name="email" type="email" />
    <label for="email">Email</label>
    <p class="error">Invalid email</p>
    <div v-if="show">Conditional</div>
    <ul>
      <li v-for="item in items" :key="item">{{ item }}</li>
    </ul>
    <template v-if="ready">
      <span>Ready</span>
    </template>
    <slot />
  </form>
</template>

<script setup lang="ts">
import CheckoutButton from "./CheckoutButton.vue";
const show = false;
const items: string[] = [];
const ready = true;
</script>
