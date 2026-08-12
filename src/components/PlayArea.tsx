import { useEffect, useRef, useState } from "react";
import type { GameState, CardData, LogEntry } from "../types";
import PlayingCard from "./PlayingCard";
import "./PlayArea.css";

interface CardJitter {
  rot: number;
  dx: number;
  dy: number;
}

interface ThrowData {
  id: string;
  playerId: string;
  cards: CardData[];
  x: number;
  y: number;
  rot: number;
  jitters: CardJitter[];
  isNew: boolean;
  isPower: boolean;
  zIndex: number;
}

interface Props {
  state: GameState;
}

let globalThrowCounter = 0;

const getHandName = (cards: CardData[]): string | null => {
  if (cards.length === 2) return "Pair!";
  if (cards.length === 3) return "Three of a Kind!";
  if (cards.length === 4) return "Four of a Kind!";
  if (cards.length === 5) {
    const suits = new Set(cards.map(c => c.suit));
    const isFlush = suits.size === 1;
    const counts = Object.values(
      cards.reduce((acc, c) => { acc[c.rank] = (acc[c.rank] || 0) + 1; return acc; }, {} as Record<string, number>)
    ).sort((a, b) => b - a);

    if (counts[0] === 4) return "Four of a Kind!";
    if (counts[0] === 3 && counts[1] === 2) return "Full House!";

    const r = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
    const rankIdxs = cards.map(c => r.indexOf(c.rank)).sort((a, b) => a - b);
    const isStraight = 
      rankIdxs.every((idx, i, arr) => i === 0 || idx === arr[i - 1] + 1) ||
      rankIdxs.join(',') === "0,1,2,11,12" ||
      rankIdxs.join(',') === "0,1,2,3,12";

    if (isStraight && isFlush) return "Straight Flush!!!";
    if (isFlush) return "Flush!";
    if (isStraight) return "Straight!";
  }
  return null;
};

/** Extracts the true "top" card of a straight (factoring in wrap-arounds) */
const getStraightTopCard = (cards: CardData[]): CardData => {
  const r = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
  const rankIdxs = cards.map(c => r.indexOf(c.rank)).sort((a, b) => a - b);
  const key = rankIdxs.join(',');
  
  if (key === "0,1,2,11,12") return cards.find(c => c.rank === "5")!;
  if (key === "0,1,2,3,12") return cards.find(c => c.rank === "6")!;
  
  return cards.reduce((max, c) => r.indexOf(c.rank) > r.indexOf(max.rank) ? c : max, cards[0]);
};

/** Seeded pseudo-random generator so re-renders of the same play don't jitter around. */
const makePseudoRand = (seedKey: string) => {
  let seed = 0;
  for (let i = 0; i < seedKey.length; i++) {
    seed = seedKey.charCodeAt(i) + ((seed << 5) - seed);
  }
  return (min: number, max: number) => {
    seed = (Math.imul(741103597, seed) + 1) | 0;
    const val = (seed >>> 0) / 4294967296;
    return min + val * (max - min);
  };
};

/** Parse a wire card code like "2D" back into a renderable CardData. */
const parseCardCode = (code: string): CardData => {
  const suit = code.slice(-1) as CardData["suit"];
  const rank = code.slice(0, -1);
  return { rank, suit, code, value: 0 };
};

export default function PlayArea({ state }: Props) {
  const [pile, setPile] = useState<ThrowData[]>([]);
  const [popup, setPopup] = useState<{ id: string, text: string } | null>(null);
  const [unbeatableFlash, setUnbeatableFlash] = useState<ThrowData | null>(null);
  const [sweeping, setSweeping] = useState(false);
  
  const prevPlayRef = useRef<CardData[] | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sweepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLogLenRef = useRef(0);

  const getDirection = (playerId: string) => {
    if (playerId === state.yourId) return { x: 0, y: 300, rot: -40 }; 
    const you = state.players.find(p => p.id === state.yourId);
    const other = state.players.find(p => p.id === playerId);
    if (!you || !other) return { x: 0, y: -300, rot: 15 };
    
    const n = state.players.length;
    const diff = (other.seat - you.seat + n) % n;
    
    if (n === 3) {
       if (diff === 1) return { x: -420, y: -240, rot: -42 }; 
       if (diff === 2) return { x: 420, y: -240, rot: 42 };   
    } else {
       if (diff === 1) return { x: -420, y: -240, rot: -42 }; 
       if (diff === 2) return { x: 0, y: -400, rot: 15 };     
       if (diff === 3) return { x: 420, y: -240, rot: 42 };   
    }
    return { x: 0, y: -300, rot: 15 };
  };

  const buildThrow = (id: string, playerId: string, cards: CardData[], isPower: boolean): ThrowData => {
    const rand = makePseudoRand(id);
    globalThrowCounter++;
    return {
      id,
      playerId,
      cards,
      x: rand(-48, 48),
      y: rand(-32, 32),
      rot: rand(-28, 28),
      jitters: cards.map(() => ({
        rot: rand(-18, 18),
        dx: rand(-18, 18),
        dy: rand(-12, 12),
      })),
      isNew: true,
      isPower,
      zIndex: globalThrowCounter,
    };
  };

  useEffect(() => {
    if (!state.lastPlay) {
      setPopup(null);
      prevPlayRef.current = null;
      if (sweepTimeoutRef.current) clearTimeout(sweepTimeoutRef.current);
      if (pile.length > 0) {
        setSweeping(true);
        sweepTimeoutRef.current = setTimeout(() => {
          setPile([]);
          setSweeping(false);
        }, 480);
      } else {
        setPile([]);
      }
      return;
    }

    setSweeping(false);
    if (sweepTimeoutRef.current) {
      clearTimeout(sweepTimeoutRef.current);
      sweepTimeoutRef.current = null;
    }

    const currentCards = state.lastPlay.cards;
    const playId = currentCards.map(c => c.code).join('-');
    const isPower = currentCards.length >= 2;

    setPile(prev => {
      if (prev.length > 0 && prev[prev.length - 1].id === playId) {
         return prev;
      }

      let handText = getHandName(currentCards);
      
      // "With the Diamond" logic
      const prevCards = prevPlayRef.current;
      if (prevCards && currentCards.length === prevCards.length) {
        if (currentCards.length === 2 && currentCards[0].rank === prevCards[0].rank) {
          // Same-rank pair beaten by the diamond
          if (currentCards.some(c => c.suit === 'D')) {
            handText = "WITH THE DIAMOND!";
          }
        } else if (currentCards.length === 5 && handText === "Straight!") {
          // Same-rank straight beaten by the diamond
          const currentTop = getStraightTopCard(currentCards);
          const prevTop = getStraightTopCard(prevCards);
          if (currentTop.rank === prevTop.rank && currentTop.suit === 'D') {
            handText = "WITH THE DIAMOND!";
          }
        }
      }

      if (handText) {
        setPopup({ id: playId, text: handText });
      }

      // Update ref for the next turn to compare against
      prevPlayRef.current = currentCards;

      const newThrow = buildThrow(playId, state.lastPlay!.playerId, currentCards, isPower);
      return [...prev.map(p => ({ ...p, isNew: false })), newThrow].slice(-10);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lastPlay]);

  useEffect(() => {
    if (state.log.length > lastLogLenRef.current) {
      const newEntries = state.log.slice(lastLogLenRef.current);
      const hit = newEntries.find((e): e is LogEntry & { playerId: string; cards: string[] } =>
        e.type === "unbeatable" && !!e.playerId && !!e.cards?.length
      );
      if (hit) {
        const cards = hit.cards.map(parseCardCode);
        const id = `unbeatable-${hit.ts}`;
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        setUnbeatableFlash(buildThrow(id, hit.playerId, cards, true));
        flashTimeoutRef.current = setTimeout(() => setUnbeatableFlash(null), 1600);
      }
    }
    lastLogLenRef.current = state.log.length;
  }, [state.log]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (sweepTimeoutRef.current) clearTimeout(sweepTimeoutRef.current);
    };
  }, []);
 
  const renderThrow = (t: ThrowData, dimming: number) => {
     const dir = getDirection(t.playerId);

     const fromX = `${dir.x + t.x}px`;
     const fromY = `${dir.y + t.y}px`;
     const fromRot = `${t.rot - 80}deg`;
     const landX = `calc(-50% + ${t.x}px)`;
     const landY = `calc(-50% + ${t.y}px)`;
     const landZ = `${t.zIndex * 2}px`;
     const landRot = `${t.rot}deg`;

     const style = {
        position: 'absolute',
        left: '50%',
        top: '50%',
        display: 'flex',
        alignItems: 'center',
        zIndex: t.zIndex,
        opacity: dimming,
        transform: `translate(${landX}, ${landY}) translateZ(${landZ}) rotate(${landRot})`,
        filter: `drop-shadow(-5px 12px 14px rgba(0,0,0,${0.35 + (1 - dimming) * 0.3}))`,
        '--fx': fromX,
        '--fy': fromY,
        '--fr': fromRot,
        '--lx': landX,
        '--ly': landY,
        '--lz': landZ,
        '--lr': landRot,
     } as React.CSSProperties;

     return (
        <div key={t.id} className={`pile-throw ${t.isNew ? 'fling' : 'settle'} ${t.isPower ? 'power-play' : ''}`} style={style}>
           {t.cards.map((card, i) => {
              const j = t.jitters[i];
              return (
                 <PlayingCard
                    key={card.code}
                    card={card}
                    size="md"
                    disabled
                    style={{
                       marginLeft: i === 0 ? 0 : '-24px',
                       transform: `rotate(${j.rot}deg) translate(${j.dx}px, ${j.dy}px) translateZ(${i * 1.5}px)`,
                       zIndex: i,
                    }}
                 />
              )
           })}
        </div>
     )
  };

  return (
    <div className="play-area">
      <div className={`pile ${sweeping ? "pile--sweeping" : ""}`}>
        {pile.map((t, idx) => {
           const dimming = Math.max(0.35, 1 - (pile.length - 1 - idx) * 0.15);
           return renderThrow(t, dimming);
        })}
      </div>

      {unbeatableFlash && (
        <div className="pile unbeatable-flash-layer">
          {renderThrow(unbeatableFlash, 1)}
        </div>
      )}

      {popup && (
        <div key={popup.id} className="power-popup">
          {popup.text}
        </div>
      )}

      {unbeatableFlash && (
        <div key={unbeatableFlash.id} className="power-popup power-popup--unbeatable">
          UNBEATABLE!
        </div>
      )}
    </div>
  );
}