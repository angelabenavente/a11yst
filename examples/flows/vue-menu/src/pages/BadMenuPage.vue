<script setup lang="ts">
import { nextTick, ref } from "vue";

const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const firstItemRef = ref<HTMLAnchorElement | null>(null);

function openMenu() {
  open.value = true;
  nextTick(() => {
    firstItemRef.value?.focus();
  });
}

function closeMenu() {
  open.value = false;
  // Intentionally skip focus return for menu-close-review style scenarios.
  nextTick(() => {
    firstItemRef.value?.focus();
  });
}
</script>

<template>
  <main>
    <h1>Bad dropdown menu</h1>
    <p class="note">Escape is ignored. Closing leaves focus on a menu item instead of the trigger.</p>
    <button
      id="bad-menu-trigger"
      ref="triggerRef"
      type="button"
      @click="open ? closeMenu() : openMenu()"
    >
      Open bad menu
    </button>
    <ul v-show="open" id="bad-menu" class="menu-panel">
      <li>
        <a ref="firstItemRef" href="#">Profile</a>
      </li>
      <li>
        <a href="#">Settings</a>
      </li>
      <li>
        <a href="#">Sign out</a>
      </li>
    </ul>
  </main>
</template>
