import { useMemo } from "react";
import type { GameState } from "../types";
import "./ResultsOverlay.css";

interface Props {
  state: GameState;
  onNewRound: () => void;
}
 
const NEON_COLORS = ["#2dd4c4", "#ff5470", "#aa3bff", "#f2b705"];
const CONFETTI_COLORS = ["#f2b705", "#f7d774", "#e8447a", "#2dd4c4", "#f5efe0"];

/** Purely decorative fiesta confetti burst for the round winner. Seeded so it
 * doesn't reshuffle every re-render, and skipped entirely under
 * prefers-reduced-motion via the CSS media query in ResultsOverlay.css. */
function ConfettiBurst({ pieceCount = 42 }: { pieceCount?: number }) {
  const pieces = useMemo(() => {
    let seed = 918273;
    const rand = () => {
      seed = (Math.imul(48271, seed) + 1) % 2147483647;
      return seed / 2147483647;
    };
    return Array.from({ length: pieceCount }, (_, i) => ({
      id: i,
      left: rand() * 100,
      delay: rand() * 0.9,
      duration: 2.4 + rand() * 1.6,
      drift: (rand() - 0.5) * 140,
      rot: rand() * 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      isStrip: rand() > 0.5,
    }));
  }, [pieceCount]);

  return (
    <div className="confetti-burst" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`confetti-piece ${p.isStrip ? "confetti-piece--strip" : "confetti-piece--dot"}`}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            "--drift": `${p.drift}px`,
            "--rot": `${p.rot}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export default function ResultsOverlay({ state, onNewRound }: Props) {
  const you = state.players.find((p) => p.id === state.yourId);
  const ranked = [...state.players].sort((a, b) => (a.finishedRank ?? 99) - (b.finishedRank ?? 99));
  const hasWinner = ranked.some((p) => p.finishedRank === 1);

  return (
    <div className="results-overlay">
      {hasWinner && <ConfettiBurst />}
      <div className="results-card">
        <h2 className="results-title">Game Over</h2>
        <ul className="results-list">
          {ranked.map((p, i) => {
            const color = NEON_COLORS[p.seat % NEON_COLORS.length];
            const isWinner = p.finishedRank === 1;
            return (
              <li
                key={p.id}
                className={p.id === state.yourId ? "results-list__row results-list__row--you" : "results-list__row"}
                style={{ "--idx": i } as React.CSSProperties}
              > 
                <span
                  className={`results-list__medal ${isWinner ? "results-list__medal--winner" : ""}`}
                  style={{ "--idx": i } as React.CSSProperties}
                >
                  {p.finishedRank ? (
                    <img 
                      src={`/place/${p.finishedRank}.webp`} 
                      alt={`Place ${p.finishedRank}`} 
                      style={{ height: '60px', width: 'auto', objectFit: 'contain', display: 'block' }} 
                    />
                  ) : "🂠"}
                </span>
                <span className="results-list__name" style={{ color }}>{p.name}</span> 
              </li>
            );
          })}
        </ul>
        {you?.isHost ? (
          <button className="btn btn--gold" onClick={onNewRound}>
            Back to lobby
          </button>
        ) : (
          <p className="lobby-waiting">Waiting for the host to return to the lobby…</p>
        )}
      </div>
    </div>
  );
}
