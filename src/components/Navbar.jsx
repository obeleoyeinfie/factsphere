import { ArrowRight, Heart, Menu, Moon, Search, Sun, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

export default function Navbar({ darkMode, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  function search(event) {
    event.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    setMenuOpen(false);
  }

  const links = [
    ["/", "Discover"],
    ["/categories", "Categories"],
    ["/random", "Shuffle"],
    ["/about", "About"],
  ];

  return (
    <header className="site-header">
      <div className="nav-inner">
        <Link to="/" className="brand" aria-label="FactSphere home"><span className="brand-mark">f.</span><span>fact<span>sphere</span></span></Link>
        <button type="button" className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        <nav className={`main-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
          {links.map(([href, label]) => <NavLink key={href} to={href} end={href === "/"} onClick={() => setMenuOpen(false)}>{label}</NavLink>)}
          <NavLink to="/favorites" className="nav-favorites" onClick={() => setMenuOpen(false)}><Heart size={16} /> Favorites</NavLink>
        </nav>
        <div className={`nav-actions ${menuOpen ? "is-open" : ""}`}>
          <form className="nav-search" role="search" onSubmit={search}>
            <Search size={16} aria-hidden="true" />
            <input aria-label="Search facts" placeholder="Find a fact…" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button type="submit" aria-label="Submit search"><ArrowRight size={15} /></button>
          </form>
          <button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>
      </div>
    </header>
  );
}
