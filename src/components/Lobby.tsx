import { useState } from "react";
import type { GameState } from "../types";
import "./Lobby.css";

const NEON_COLORS = ["#2dd4c4", "#ff5470", "#aa3bff", "#f2b705"];

interface JoinProps {
  status: string;
  onJoin: (name: string) => void;
}

export function JoinScreen({ status, onJoin }: JoinProps) {
  const [name, setName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onJoin(name.trim());
  };

  return (
    <div className="join-screen">
      <div className="join-card">
        <video className="join-card__video" src="/2.mp4" autoPlay loop muted playsInline />
        <div className="join-card__overlay" />
        <div className="join-card__content">
          <h1 className="join-title">
            <span>PUSOY</span>
          </h1> 

          <form onSubmit={submit} className="join-form">
            <label className="join-label">
              Your name
              <input
                autoFocus
                maxLength={16}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Poopie Face"
              />
            </label>
            <button className="btn btn--gold join-submit" type="submit" disabled={!name.trim() || status === "connecting"}>
              {status === "connecting" ? "Connecting…" : "Join Game"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

interface RoomLobbyProps {
  state: GameState;
  onStart: () => void;
  onAddBot: () => void;
  onRemoveBot: (botId: string) => void;
  onLeave: () => void;
}

export function RoomLobby({ state, onStart, onAddBot, onRemoveBot, onLeave }: RoomLobbyProps) {
  const you = state.players.find((p) => p.id === state.yourId);
  const canStart = you?.isHost && state.players.length === 3;
  const emptySlots = Math.max(0, 3 - state.players.length);

  return (
    <div className="join-screen">
      <div className="join-card lobby-card">
        <video className="join-card__video" src="/2.mp4" autoPlay loop muted playsInline />
        <div className="join-card__overlay" />
        <div className="join-card__content">
          <h1 className="join-title">
            <span>Lobby</span>
          </h1> 
          <ul className="lobby-players">
            {state.players.map((p, i) => {
              const color = NEON_COLORS[p.seat % NEON_COLORS.length];
              return (
                <li
                  key={p.id}
                  className={`lobby-players__row ${p.connected || p.isBot ? "" : "lobby-players__row--offline"}`}
                  style={{ "--idx": i } as React.CSSProperties}
                >
                  <span className="lobby-players__avatar" style={{ background: color, color: "var(--bg-night)" }}>
                    {p.isBot ? "🤖" : p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="lobby-players__name" style={{ color, textShadow: `0 0 8px ${color}` }}>
                    {p.name}
                  </span>
                  {p.isHost && <span className="chip chip--gold">HOST</span>}
                  {!p.isBot && !p.connected && <span className="chip chip--danger">OFFLINE</span>}
                  {p.isBot && you?.isHost && (
                    <label className="lobby-bot-toggle" title="Remove computer player">
                      <input type="checkbox" checked onChange={() => onRemoveBot(p.id)} />
                      <span>Computer</span>
                    </label>
                  )}
                </li>
              );
            })}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <li
                key={`empty-${i}`}
                className="lobby-players__row lobby-players__row--empty"
                style={{ "--idx": state.players.length + i } as React.CSSProperties}
              >
                <span className="lobby-players__avatar lobby-players__avatar--empty">?</span>
                <span className="lobby-players__name">Waiting for player…</span>
                {you?.isHost && (
                  <label className="lobby-bot-toggle" title="Fill this seat with a computer player">
                    <input type="checkbox" checked={false} onChange={onAddBot} />
                    <span>Computer</span>
                  </label>
                )}
              </li>
            ))}
          </ul>

          {you?.isHost ? (
            <button className="btn btn--gold join-submit" style={{ marginTop: '16px' }} disabled={!canStart} onClick={() => onStart()}>
              {canStart ? "Deal the cards" : `Need exactly 3 players seated`}
            </button>
          ) : (
            <p className="lobby-waiting">Waiting for the host to start the game…</p>
          )}

          <button className="btn btn--ghost" onClick={onLeave}>
            Leave table
          </button>
        </div>
      </div>
    </div>
  );
}