<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from "vue";

const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const firstItemRef = ref<HTMLAnchorElement | null>(null);

function openMenu() {
  open.value = true;
  nextTick(() => {
    firstItemRef.value?.focus();
  });
}

function closeMenu(restoreFocus = true) {
  open.value = false;
  if (restoreFocus) {
    nextTick(() => {
      triggerRef.value?.focus();
    });
  }
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" && !open.value) {
    event.preventDefault();
    openMenu();
  }
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && open.value) {
    event.preventDefault();
    closeMenu(true);
  }
}

document.addEventListener("keydown", onDocumentKeydown);
onBeforeUnmount(() => {
  document.removeEventListener("keydown", onDocumentKeydown);
});
</script>

<template>
  <main>
    <h1>Accessible dropdown menu</h1>
    <p class="note">Opening moves focus into the menu. Escape closes and returns focus to the trigger.</p>
    <button
      id="accessible-menu-trigger"
      ref="triggerRef"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      aria-controls="accessible-menu"
      @click="open ? closeMenu(true) : openMenu()"
      @keydown="onTriggerKeydown"
    >
      Open accessible menu
    </button>
    <ul
      v-show="open"
      id="accessible-menu"
      class="menu-panel"
      role="menu"
      aria-labelledby="accessible-menu-trigger"
    >
      <li role="none">
        <a ref="firstItemRef" role="menuitem" href="#">Profile</a>
      </li>
      <li role="none">
        <a role="menuitem" href="#">Settings</a>
      </li>
      <li role="none">
        <a role="menuitem" href="#">Sign out</a>
      </li>
    </ul>
  </main>
</template>
