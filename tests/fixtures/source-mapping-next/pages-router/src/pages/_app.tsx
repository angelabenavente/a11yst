export default function App({ Component, pageProps }: { Component: React.ComponentType; pageProps: object }) {
  return (
    <>
      <button id="submit-order">Shared app shell</button>
      <Component {...pageProps} />
    </>
  );
}
