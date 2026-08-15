<template>
  <div>
    <UI.Button id="ui-button" />
    <Form.ErrorMessage />
    <component :is="dynamic" />
    <component is="CheckoutButton" />
    <CheckoutButton />
    <checkout-button />
  </div>
</template>

<script setup lang="ts">
const dynamic = "CheckoutButton";
</script>
