export type Suit = "D" | "C" | "H" | "S";

export interface CardData {
  rank: string;
  suit: Suit;
  code: string;
  value: number;
}

export interface PlayerPublic {
  id: string;
  name: string;
  seat: number;
  cardCount: number;
  connected: boolean;
  finishedRank: number | null;
  isHost: boolean;
  isBot: boolean;
}

export type LogKind = "system" | "play" | "pass" | "finish" | "unbeatable";

export interface LogEntry {
  type: LogKind;
  message: string;
  ts: number;
  playerId?: string;
  cards?: string[];
}

export type Phase = "lobby" | "playing" | "finished";

export interface GameState {
  type: "state";
  roomCode: string;
  mode: 3 | null;
  phase: Phase;
  players: PlayerPublic[];
  yourHand: CardData[];
  yourId: string;
  currentTurnPlayerId: string | null;
  lastPlay: { playerId: string; cards: CardData[] } | null;
  passCount: number;
  finishedOrder: string[];
  log: LogEntry[];
}

export interface JoinedMessage {
  type: "joined";
  roomCode: string;
  playerId: string;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ServerMessage = GameState | JoinedMessage | ErrorMessage;
