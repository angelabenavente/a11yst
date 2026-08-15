export function Sensitive() {
  return (
    <>
      <input
        type="password"
        value="SuperSecretPassword123"
        onChange={() => undefined}
      />
      <button
        data-testid="safe-button"
        title="Safe title"
        onClick={() => undefined}
        dangerouslySetInnerHTML={{ __html: "<span>unsafe</span>" }}
      >
        Token ABC123SECRET
      </button>
      <a href="javascript:alert(1)">Bad link</a>
      <meta name="authorization" content="Bearer secret-token" />
    </>
  );
}
