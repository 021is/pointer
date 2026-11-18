// Lumen: a made-up events app, only here to try Pointer on. Every name and event is fictional.
import { EventCard } from "./EventCard.jsx";
import { Filters } from "./Filters.jsx";
import { Header } from "./Header.jsx";
import { Hero } from "./Hero.jsx";

const EVENTS = [
  { id: 1, title: "Night Market Live", kind: "Festival", date: "Sat, Dec 6", place: "Harbour Hall", price: "€18", hue: 262 },
  { id: 2, title: "Synth & Strings", kind: "Concert", date: "Fri, Dec 12", place: "Old Mill", price: "€24", hue: 18 },
  { id: 3, title: "Pottery for Beginners", kind: "Workshop", date: "Sun, Dec 14", place: "Studio Nine", price: "€35", hue: 152 },
  { id: 4, title: "Rooftop Cinema: Classics", kind: "Film", date: "Thu, Dec 18", place: "Skyline Deck", price: "€12", hue: 205 },
  { id: 5, title: "Winter Run 10K", kind: "Sport", date: "Sat, Dec 20", place: "River Park", price: "Free", hue: 340 },
  { id: 6, title: "Jazz Brunch", kind: "Music", date: "Sun, Dec 21", place: "Café Arden", price: "€22", hue: 45 },
];

export function App() {
  return (
    <div className="app">
      <Header />
      <Hero />
      <main className="content">
        <Filters count={EVENTS.length} />
        <section className="grid">
          {EVENTS.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </section>
      </main>
    </div>
  );
}
