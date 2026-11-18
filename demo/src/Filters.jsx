const CHIPS = ["All", "Music", "Workshops", "Food", "Outdoors", "Free"];

export function Filters({ count }) {
  return (
    <div className="filters" id="events">
      <h2 className="section-title">{count} events</h2>
      <div className="chips">
        {CHIPS.map((c, i) => (
          <button type="button" key={c} className={i === 0 ? "chip chip-active" : "chip"}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
