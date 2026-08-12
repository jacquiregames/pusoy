import { useEffect, useRef, useState } from "react";
import type { PlayerPublic } from "../types";
import PlayingCard from "./PlayingCard";
import "./Opponent.css";

interface Props {
  player: PlayerPublic;
  isTurn: boolean;
  position: "left" | "right" | "top";
  passSignal?: number | null;
  finishSignal?: { rank: number; key: number } | null;
}

const NEON_COLORS = ["#2dd4c4", "#ff5470", "#aa3bff", "#f2b705"];
const LEAVE_ANIM_MS = 320;
const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const medalFor = (rank: number) => MEDALS[rank] ?? "🎖️";

export default function Opponent({ player, isTurn, position, passSignal, finishSignal }: Props) {
  const playerColor = NEON_COLORS[player.seat % NEON_COLORS.length];

  const isLowCards = !player.finishedRank && player.cardCount > 0 && player.cardCount <= 2;

  const [displayCount, setDisplayCount] = useState(player.cardCount);
  const [leavingIdx, setLeavingIdx] = useState<number[]>([]);
  const prevCount = useRef(player.cardCount);

  useEffect(() => {
    if (player.cardCount < prevCount.current) {
      const removed = prevCount.current - player.cardCount;
      const idxs = Array.from({ length: removed }, (_, i) => prevCount.current - 1 - i);
      setLeavingIdx(idxs);
      const t = setTimeout(() => {
        setLeavingIdx([]);
        setDisplayCount(player.cardCount);
      }, LEAVE_ANIM_MS);
      prevCount.current = player.cardCount;
      return () => clearTimeout(t);
    }
    setDisplayCount(player.cardCount);
    prevCount.current = player.cardCount;
  }, [player.cardCount]);

  const fanCount = Math.min(displayCount, 13);
  const cards = Array.from({ length: fanCount });

return (
    <div 
      className={`opponent opponent--${position} ${isTurn ? "opponent--active" : ""} ${!player.isBot && !player.connected ? "opponent--offline" : ""} ${isLowCards ? "opponent--low-cards" : ""}`}
      style={{ "--player-color": playerColor } as React.CSSProperties}
    >
      {passSignal != null && (
        <span key={passSignal} className="pass-bubble">Pass</span>
      )}
      {finishSignal != null && (
        <span key={finishSignal.key} className="finish-medal">{medalFor(finishSignal.rank)}</span>
      )}
      <div className="opponent__info">
        <div className="opponent__avatar" style={{ background: playerColor, color: "var(--bg-night)" }}>
          {player.isBot ? "🤖" : player.name.slice(0, 1).toUpperCase()}
          {isTurn && (
            <div className="opponent__indicator">
              <img src="/turn.png" alt="Turn Indicator" width={40} height={80} className="turn-indicator" style={{ objectFit: 'contain' }} />
            </div>
          )}
        </div>
        <div className="opponent__meta">
          <span className="opponent__name" style={{ color: playerColor }}>
            {player.name}
            {player.isHost && <span className="opponent__host-dot" title="Host" />}
          </span>
          <span className="opponent__count" key={`${player.cardCount}-${player.finishedRank ?? ""}`}>
            {player.finishedRank ? `Finished #${player.finishedRank}` : `Cards: ${player.cardCount}`}
          </span>
        </div>
      </div>
      <div className="opponent__fan">
        {cards.map((_, i) => (
          <PlayingCard
            key={i}
            faceDown
            size="sm"
            className={leavingIdx.includes(i) ? "opponent-card--leaving" : ""}
            style={{ marginLeft: i === 0 ? 0 : -30, zIndex: i }}
          />
        ))}
      </div>
      {!player.isBot && !player.connected && <span className="opponent__offline-badge">Reconnecting…</span>}
    </div>
  );
}