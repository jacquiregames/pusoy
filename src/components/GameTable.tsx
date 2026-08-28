import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState } from "../types";
import Opponent from "./Opponent";
import PlayArea from "./PlayArea";
import PlayerHand from "./PlayerHand";
import ResultsOverlay from "./ResultsOverlay";
import "./GameTable.css";

interface Props {
  state: GameState;
  onPlay: (codes: string[]) => void;
  onPass: () => void;
  onNewRound: () => void;
  onLeave: () => void;
}

export default function GameTable({ state, onPlay, onPass, onNewRound, onLeave }: Props) {
  const [logOpen, setLogOpen] = useState(false); 
  
  const [bgIndex, setBgIndex] = useState<1 | 2 | 3 | 4>(() => {
    const saved = localStorage.getItem("pusoy-bg");
    if (saved === "2") return 2;
    if (saved === "3") return 3;
    if (saved === "4") return 4;
    return 1;
  });
  
  const [cbIndex, setCbIndex] = useState<1 | 2 | 3 | 4 | 5>(() => {
    const saved = localStorage.getItem("pusoy-cb");
    if (saved === "2") return 2;
    if (saved === "3") return 3;
    if (saved === "4") return 4;
    if (saved === "5") return 5;    
    return 1;
  });

  const you = state.players.find((p) => p.id === state.yourId);

  const seatedOpponents = useMemo(() => {
    const n = state.players.length;
    const yourSeat = you?.seat ?? 0;
    const ordered = [];
    for (let i = 1; i < n; i++) {
      ordered.push(state.players[(yourSeat + i) % n]);
    }
    
    return [
      { player: ordered[0], position: "left" as const },
      { player: ordered[1], position: "right" as const },
    ];
  }, [state.players, you]);

  const isYourTurn = state.currentTurnPlayerId === state.yourId;
  const mustLead = state.lastPlay === null;
  const requiredCount = state.lastPlay ? state.lastPlay.cards.length : null;
  const currentTurnName = state.players.find((p) => p.id === state.currentTurnPlayerId)?.name ?? null;

  const [passFlash, setPassFlash] = useState<{ playerId: string; key: number } | null>(null);
  const [finishFlash, setFinishFlash] = useState<{ playerId: string; rank: number; key: number } | null>(null);
  const lastLogLen = useRef(0);

  useEffect(() => {
    if (state.log.length > lastLogLen.current) {
      const newest = state.log[state.log.length - 1];
      if (newest?.type === "pass" && newest.playerId) {
        setPassFlash({ playerId: newest.playerId, key: Date.now() });
      }
      if (newest?.type === "finish" && newest.playerId) {
        const rank = state.players.find((p) => p.id === newest.playerId)?.finishedRank;
        if (rank) {
          setFinishFlash({ playerId: newest.playerId, rank, key: Date.now() });
        }
      }
    }
    lastLogLen.current = state.log.length;
  }, [state.log, state.players]);

  useEffect(() => {
    document.body.style.backgroundImage = `url('/tables/table${bgIndex}.png')`;
    localStorage.setItem("pusoy-bg", bgIndex.toString());
  }, [bgIndex]);

  useEffect(() => {
    localStorage.setItem("pusoy-cb", cbIndex.toString());
    window.dispatchEvent(new Event("pusoy-cb-changed"));
  }, [cbIndex]);

  return (
    <div className="table-screen">
      {isYourTurn && (
        <img src="/yourturn.png" alt="Your turn" className="yourturn-indicator" />
      )}
      <header className="table-header">
        <div className="table-header__actions">
          <button className="btn btn--ghost btn--sm" onClick={() => setBgIndex((v) => (v === 1 ? 2 : v === 2 ? 3 : v === 3 ? 4 : 1))}>
            Table
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setCbIndex((v) => (v === 1 ? 2 : v === 2 ? 3 : v === 3 ? 4 : v === 4 ? 5 : 1))}>
            Cardback
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setLogOpen((v) => !v)}>
            {logOpen ? "Hide log" : "Show log"}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onLeave}>
            Leave
          </button>
        </div>
      </header>

      <div className={`table-felt table-felt--${state.mode}p`}>
        {seatedOpponents.map(({ player, position }) => {
          if (!player) return null; // Safe guard
          return (
            <div key={player.id} className={`seat-slot seat-slot--${position}`}>
              <Opponent
                player={player}
                isTurn={state.currentTurnPlayerId === player.id}
                position={position}
                passSignal={passFlash?.playerId === player.id ? passFlash.key : null}
                finishSignal={
                  finishFlash?.playerId === player.id ? { rank: finishFlash.rank, key: finishFlash.key } : null
                }
              />
            </div>
          );
        })}

        <div className="table-felt__center">
          <PlayArea state={state} />
        </div>
      </div>

      <div className="player-hand-wrap">
        {passFlash?.playerId === state.yourId && (
          <span key={passFlash.key} className="pass-bubble pass-bubble--you">Pass</span>
        )}
        {finishFlash?.playerId === state.yourId && (
          <span key={finishFlash.key} className="finish-medal finish-medal--you">
            {finishFlash.rank === 1 ? "🥇" : finishFlash.rank === 2 ? "🥈" : finishFlash.rank === 3 ? "🥉" : "🎖️"}
          </span>
        )}
        <PlayerHand
          cards={state.yourHand}
          isYourTurn={isYourTurn}
          mustLead={mustLead}
          requiredCount={requiredCount}
          lastPlayCards={state.lastPlay?.cards ?? null}
          currentTurnName={currentTurnName}
          yourFinishedRank={you?.finishedRank ?? null}
          onPlay={onPlay}
          onPass={onPass}
        />
      </div>

      {logOpen && (
        <aside className="log-drawer scrollbar-thin">
          <h3>Table talk</h3>
          <ul>
            {[...state.log].reverse().map((entry, i) => (
              <li key={i} className={`log-drawer__row log-drawer__row--${entry.type}`}>
                {entry.message}
              </li>
            ))}
          </ul>
        </aside>
      )}

      {state.phase === "finished" && <ResultsOverlay state={state} onNewRound={onNewRound} />}
    </div>
  );
}