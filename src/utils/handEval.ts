import type { CardData } from "../types";

// Mirrors backend/app/hands.py so the client can tell, without asking the
// server, whether the current player holds any legal reply to the last play.
// Rank order (low -> high): 3 4 5 6 7 8 9 10 J Q K A 2
// Suit order (low -> high): Clubs < Spades < Hearts < Diamonds

const RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
const SUITS = ["C", "S", "H", "D"];

const rankValue = (r: string) => RANKS.indexOf(r);
const suitValue = (s: string) => SUITS.indexOf(s);
const cardValue = (c: CardData) => rankValue(c.rank) * 4 + suitValue(c.suit);

enum FiveKind {
  STRAIGHT = 0,
  FLUSH = 1,
  FULL_HOUSE = 2,
  FOUR_KIND = 3,
  STRAIGHT_FLUSH = 4,
}

function isStraight(sortedRankVals: number[]): boolean {
  if (sortedRankVals.every((v, i, arr) => i === 0 || v === arr[i - 1] + 1)) return true;
  const key = sortedRankVals.join(",");
  if (key === "0,1,2,11,12") return true; // A-2-3-4-5
  if (key === "0,1,2,3,12") return true; // 2-3-4-5-6
  return false;
}

function classifyFive(cards: CardData[]): FiveKind | null {
  const rankVals = cards.map((c) => rankValue(c.rank)).sort((a, b) => a - b);
  const counts: Record<string, number> = {};
  cards.forEach((c) => (counts[c.rank] = (counts[c.rank] || 0) + 1));
  const countList = Object.values(counts).sort((a, b) => b - a);
  const isFlush = new Set(cards.map((c) => c.suit)).size === 1;
  const straight = isStraight(rankVals);

  if (straight && isFlush) return FiveKind.STRAIGHT_FLUSH;
  if (countList[0] === 4) return FiveKind.FOUR_KIND;
  if (countList[0] === 3 && countList[1] === 2) return FiveKind.FULL_HOUSE;
  if (isFlush) return FiveKind.FLUSH;
  if (straight) return FiveKind.STRAIGHT;
  return null;
}

function fiveCardKey(cards: CardData[], kind: FiveKind): [number, number] {
  if (kind === FiveKind.STRAIGHT || kind === FiveKind.STRAIGHT_FLUSH || kind === FiveKind.FLUSH) {
    const rankVals = cards.map((c) => rankValue(c.rank)).sort((a, b) => a - b);
    if (kind !== FiveKind.FLUSH) {
      const key = rankVals.join(",");
      if (key === "0,1,2,11,12") {
        const top = cards.find((c) => c.rank === "5")!;
        return [rankValue(top.rank), suitValue(top.suit)];
      }
      if (key === "0,1,2,3,12") {
        const top = cards.find((c) => c.rank === "6")!;
        return [rankValue(top.rank), suitValue(top.suit)];
      }
    }
    const top = cards.reduce((a, b) => (cardValue(a) > cardValue(b) ? a : b));
    return [rankValue(top.rank), suitValue(top.suit)];
  }
  const counts: Record<string, number> = {};
  cards.forEach((c) => (counts[c.rank] = (counts[c.rank] || 0) + 1));
  const need = kind === FiveKind.FULL_HOUSE ? 3 : 4;
  const rank = Object.keys(counts).find((r) => counts[r] === need)!;
  return [rankValue(rank), 0];
}

function compareFive(a: CardData[], b: CardData[]): number {
  const kindA = classifyFive(a);
  const kindB = classifyFive(b);
  if (kindA === null || kindB === null) return 0;
  if (kindA !== kindB) return kindA - kindB;
  const [ra, sa] = fiveCardKey(a, kindA);
  const [rb, sb] = fiveCardKey(b, kindB);
  if (ra !== rb) return ra - rb;
  return sa - sb;
}

/** Does `play` (one candidate combo from the hand) beat `lastPlay`? Both must be the same size. */
function beatsPlay(play: CardData[], lastPlay: CardData[]): boolean {
  const n = play.length;
  if (n !== lastPlay.length) return false;

  if (n === 1 || n === 2) {
    // SINGLE / PAIR: for a pair, both cards must match rank
    if (n === 2 && play[0].rank !== play[1].rank) return false;
    const maxA = Math.max(...play.map(cardValue));
    const maxB = Math.max(...lastPlay.map(cardValue));
    return maxA > maxB;
  }

  if (n === 3 || n === 4) {
    // TRIPLE / FOUR: all cards must share a rank
    if (new Set(play.map((c) => c.rank)).size !== 1) return false;
    if (new Set(lastPlay.map((c) => c.rank)).size !== 1) return false;
    return rankValue(play[0].rank) > rankValue(lastPlay[0].rank);
  }

  if (n === 5) {
    const kindPlay = classifyFive(play);
    const kindLast = classifyFive(lastPlay);
    if (kindPlay === null || kindLast === null) return false;
    return compareFive(play, lastPlay) > 0;
  }

  return false;
}

function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, size - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

/**
 * Whether the player's hand contains ANY legal combo of the required size
 * that beats lastPlay. When lastPlay is null (player is leading a fresh
 * trick), this always returns true — leading never requires "beating"
 * anything.
 */
export function canBeatRequirement(hand: CardData[], lastPlay: CardData[] | null): boolean {
  if (!lastPlay) return true;
  const size = lastPlay.length;
  if (hand.length < size) return false;

  // For 1,2,3,4-card shapes, only same-rank groups can ever be legal plays,
  // so we only need to try combos within each rank group (cheap). For
  // 5-card hands we fall back to trying all combos of the hand, which is
  // still small enough (a 17-card hand has at most C(17,5) = 6188 combos).
  if (size >= 1 && size <= 4) {
    const byRank: Record<string, CardData[]> = {};
    hand.forEach((c) => {
      byRank[c.rank] = byRank[c.rank] || [];
      byRank[c.rank].push(c);
    });
    for (const rank of Object.keys(byRank)) {
      const cardsOfRank = byRank[rank];
      if (cardsOfRank.length < size) continue;
      for (const combo of combinations(cardsOfRank, size)) {
        if (beatsPlay(combo, lastPlay)) return true;
      }
    }
    return false;
  }

  if (size === 5) {
    for (const combo of combinations(hand, 5)) {
      if (beatsPlay(combo, lastPlay)) return true;
    }
    return false;
  }

  return false;
}
