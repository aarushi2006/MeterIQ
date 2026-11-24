import { useState } from "react";

export default function MeterSearch({ meters, onSelect }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    if (!q) return;
    const found = meters.find((m) => m.id === q);
    if (found) {
      onSelect(found);
      setQuery("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch(e);
    }
  };

  return (
    <div className={`search-wrapper ${focused ? "focused" : ""}`}>
      <div className="search-icon">⌕</div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder="Search by Meter ID (e.g. MTR1001, MTR1003, MTR1005)"
        autoComplete="off"
      />
      <button className="search-btn" onClick={handleSearch}>
        Search
      </button>
    </div>
  );
}
