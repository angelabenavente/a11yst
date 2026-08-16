import Link from "next/link";

export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <main>
      <h1>Product {params.id}</h1>
      <nav aria-label="Primary">
        <Link href="/">Home</Link>
      </nav>
      <p>Sample dynamic route expanded via routeDiscovery.samples.</p>
    </main>
  );
}
