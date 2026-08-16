import Link from "next/link";

export default function BadHomePage() {
  return (
    <main>
      <h1>Bad navigation home</h1>
      <p>Client-side navigation intentionally leaves focus on the clicked link.</p>
      <nav aria-label="Primary">
        <Link href="/bad">Home</Link>
        {" · "}
        <Link href="/bad/about">About</Link>
      </nav>
    </main>
  );
}
