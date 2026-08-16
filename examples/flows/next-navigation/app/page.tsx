import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Next.js navigation flow fixtures</h1>
      <p>Two SPA navigation scenarios for route-change focus review.</p>
      <ul>
        <li>
          <Link href="/accessible">Accessible navigation</Link> — focus moves to the destination
          heading after client-side route changes.
        </li>
        <li>
          <Link href="/bad">Bad navigation</Link> — focus stays on the clicked link after route
          changes.
        </li>
      </ul>
    </main>
  );
}
