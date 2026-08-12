import { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import type { CardData } from "../types";
import PlayingCard from "./PlayingCard";
import { canBeatRequirement } from "../utils/handEval";
import "./PlayerHand.css";

interface Props {
  cards: CardData[];
  isYourTurn: boolean;
  mustLead: boolean;
  requiredCount: number | null;
  lastPlayCards: CardData[] | null;
  currentTurnName: string | null; 
  yourFinishedRank?: number | null;
  onPlay: (codes: string[]) => void;
  onPass: () => void;
}

const RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
const SUITS = ["C", "S", "H", "D"];

export default function PlayerHand({ cards, isYourTurn, mustLead, requiredCount, lastPlayCards, currentTurnName, yourFinishedRank = null, onPlay, onPass }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"rank" | "suit">("rank");
  
  const [dealKey, setDealKey] = useState(0);
  const [prevCount, setPrevCount] = useState(0);

  useEffect(() => {
    if (cards.length > prevCount && cards.length >= 13) {
      setDealKey(k => k + 1);
    }
    setPrevCount(cards.length);
  }, [cards.length, prevCount]);

  const fanRef = useRef<HTMLDivElement>(null);
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const prevDealKey = useRef(dealKey);

  const toggle = (code: string) => {
    if (!isYourTurn) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectionLooksValid = useMemo(() => {
    const n = selected.size;
    if (n === 0) return false;
    if (requiredCount) return n === requiredCount;
    return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
  }, [selected, requiredCount]);

  const mustPass = useMemo(() => {
    if (!isYourTurn || mustLead) return false;
    return !canBeatRequirement(cards, lastPlayCards);
  }, [cards, lastPlayCards, isYourTurn, mustLead]);

  const isLowCards = cards.length > 0 && cards.length <= 2;

  const handlePlay = () => {
    if (!selectionLooksValid) return;
    onPlay(Array.from(selected));
    setSelected(new Set());
  };

  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => {
      const rankA = RANKS.indexOf(a.rank);
      const rankB = RANKS.indexOf(b.rank);
      const suitA = SUITS.indexOf(a.suit);
      const suitB = SUITS.indexOf(b.suit);

      if (sortBy === "suit") {
        if (suitA !== suitB) return suitA - suitB;
        return rankA - rankB;
      } else {
        if (rankA !== rankB) return rankA - rankB;
        return suitA - suitB;
      }
    });
  }, [cards, sortBy]);

  const n = sortedCards.length;
  const maxTotalAngle = 52;
  const perCard = Math.min(6, maxTotalAngle / Math.max(n - 1, 1));
  const arcHeight = 3.2;

  useLayoutEffect(() => {
    const container = fanRef.current;
    if (!container) return;

    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-card-code]"));
    const newRects = new Map<string, DOMRect>();
    nodes.forEach((el) => newRects.set(el.dataset.cardCode!, el.getBoundingClientRect()));

    const isFreshDeal = dealKey !== prevDealKey.current;
    prevDealKey.current = dealKey;

    if (!isFreshDeal && prevRects.current.size) {
      nodes.forEach((el) => {
        const code = el.dataset.cardCode!;
        const oldRect = prevRects.current.get(code);
        const newRect = newRects.get(code);
        if (!oldRect || !newRect) return;

        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

        const baseline = el.style.transform;
        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px) ${baseline}`;
        void el.offsetWidth; 

        requestAnimationFrame(() => {
          el.style.transition = "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)";
          el.style.transform = baseline;
          const clear = () => {
            el.style.transition = "";
            el.removeEventListener("transitionend", clear);
          };
          el.addEventListener("transitionend", clear);
        });
      });
    }

    prevRects.current = newRects;
  }, [sortedCards, dealKey]);

  return (
    <div className={`player-hand ${isYourTurn ? "player-hand--your-turn" : ""} ${isLowCards ? "player-hand--low-cards" : ""}`}>
      <div className="player-hand__controls">
        <div className={`turn-indicator-pill ${isYourTurn ? "turn-indicator-pill--you" : ""}`}>
          {isYourTurn ? "Your turn" : `${currentTurnName ?? "…"}'s turn`}
        </div>

        <div className="sort-toggle-container">
          <button className={`sort-btn ${sortBy === "rank" ? "active" : ""}`} onClick={() => setSortBy("rank")}>Rank</button>
          <button className={`sort-btn ${sortBy === "suit" ? "active" : ""}`} onClick={() => setSortBy("suit")}>Suit</button>
        </div>
      </div>

      <div className="player-hand__fan" ref={fanRef}>
        {sortedCards.map((c, i) => {
          const offset = i - (n - 1) / 2;
          const angle = offset * perCard;
          const lift = Math.abs(offset) * Math.abs(offset) * arcHeight * 0.35;
          
          return (
            <PlayingCard
              key={`${c.code}-${dealKey}`}
              className="deal-anim"
              card={c}
              size="lg"
              disabled={!isYourTurn}
              selected={selected.has(c.code)}
              onClick={() => toggle(c.code)}
              style={{
                marginLeft: i === 0 ? 0 : -40,
                transform: `rotate(${angle}deg) translateY(${lift}px)`,
                transformOrigin: "50% 120%",
                zIndex: i,
                "--fan-angle": `${angle}deg`,
                "--fan-lift": `${lift}px`,
                "--idx": i,
              } as React.CSSProperties}
            />
          );
        })}
      </div>

      <div className="player-hand__actions">
        {isYourTurn ? (
          <>
            <span className="player-hand__hint">
              {mustPass
                ? "You can't beat that — Pass"
                : requiredCount
                ? `Beat the table: play exactly ${requiredCount} card${requiredCount > 1 ? "s" : ""}`
                : mustLead
                ? "You're leading — play a single, pair, triple, four of a kind, or 5-card hand"
                : "Play a single, pair, triple, four of a kind, or 5-card hand"}
            </span>
            <div className="player-hand__buttons">
              <button
                className={`btn btn--ghost ${mustPass ? "btn--pass-urgent" : ""}`}
                onClick={onPass}
                disabled={mustLead}
              >
                Pass
              </button>
              <button className="btn btn--gold" onClick={handlePlay} disabled={!selectionLooksValid}>
                Play {selected.size > 0 ? `(${selected.size})` : ""}
              </button>
            </div>
          </>
        ) : (
          <span className="player-hand__hint">
            {yourFinishedRank
              ? `You're out — finished #${yourFinishedRank}! Waiting for the round to end…`
              : "Waiting for your turn…"}
          </span>
        )}
      </div>
    </div>
  );
}