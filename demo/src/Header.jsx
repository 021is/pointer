export function Header() {
  return (
    <header className="header">
      <a className="logo" href="#top">
        <span className="logo-dot" /> Lumen
      </a>
      <nav className="nav">
        <a href="#events">Events</a>
        <a href="#places">Places</a>
        <a href="#saved">Saved</a>
      </nav>
      <button type="button" className="button button-dark">Sign in</button>
    </header>
  );
}
