export function EventCard({ event }) {
  const art = { background: `linear-gradient(135deg, hsl(${event.hue} 70% 62%), hsl(${event.hue + 40} 70% 45%))` };
  return (
    <article className="card">
      <div className="card-art" style={art}>
        <span className="card-kind">{event.kind}</span>
      </div>
      <div className="card-body">
        <h3 className="card-title">{event.title}</h3>
        <p className="card-meta">
          {event.date} · {event.place}
        </p>
        <div className="card-foot">
          <span className="card-price">{event.price}</span>
          <button type="button" className="button button-small">Get tickets</button>
        </div>
      </div>
    </article>
  );
}
