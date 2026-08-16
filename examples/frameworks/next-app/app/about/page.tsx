import Link from "next/link";

export default function AboutPage() {
  return (
    <main>
      <h1>About</h1>
      <nav aria-label="Primary">
        <Link href="/">Home</Link>
        {" · "}
        <Link href="/about">About</Link>
      </nav>
      <p>This page intentionally includes a button with no accessible name.</p>
      {/* AXE VIOLATION (button-name) */}
      <button type="button"></button>
    </main>
  );
}
