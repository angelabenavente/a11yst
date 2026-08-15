export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <button id="root-layout-button">Root layout</button>
        {children}
      </body>
    </html>
  );
}
