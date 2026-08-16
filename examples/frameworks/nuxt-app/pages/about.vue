<template>
  <main>
    <h1>About</h1>
    <nav aria-label="Primary">
      <NuxtLink to="/">Home</NuxtLink>
      ·
      <NuxtLink to="/about">About</NuxtLink>
    </nav>
    <p>This page intentionally includes a text input with no associated label.</p>
    <!-- AXE VIOLATION (label) -->
    <input type="text" name="message" />
  </main>
</template>
