import { useMemo } from "react";
import type { GameState } from "../types";
import "./ResultsOverlay.css";

interface Props {
  state: GameState;
  onNewRound: () => void;
}
 
const NEON_COLORS = ["#2dd4c4", "#ff5470", "#aa3bff", "#f2b705"];

 

export default function ResultsOverlay({ state, onNewRound }: Props) {
  const you = state.players.find((p) => p.id === state.yourId);
  const ranked = [...state.players].sort((a, b) => (a.finishedRank ?? 99) - (b.finishedRank ?? 99));
  const hasWinner = ranked.some((p) => p.finishedRank === 1);

  return (
    <div className="results-overlay">
      {hasWinner}
      <div className="results-card">
        <img src="/gameover.webp" alt="Game Over" className="results-title-img" />
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
                      style={{ height: '76px', width: 'auto', objectFit: 'contain', display: 'block' }} 
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
