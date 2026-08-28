import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, ServerMessage } from "../types";

const WS_URL =
  (import.meta as any).env?.VITE_WS_URL ||
  `ws://${window.location.hostname}:3000/ws`;

const STORAGE_KEY = "pusoydos-session";

interface StoredSession {
  playerId: string;
  name: string;
}

export type ConnectionStatus = "idle" | "connecting" | "open" | "closed";

export function useGameSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<StoredSession | null>(null);

  const send = useCallback((payload: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const ensureSocket = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        resolve(wsRef.current);
        return;
      }
      setStatus("connecting");
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("open");
        resolve(ws);
      };
      ws.onclose = () => setStatus("closed");
      ws.onerror = () => reject(new Error("Could not reach the game server. Check the server address and that it's running."));
      
      ws.onmessage = (evt) => {
        const msg: ServerMessage = JSON.parse(evt.data);
        if (msg.type === "state") {
          setState(msg);
        } else if (msg.type === "joined") {
          sessionRef.current = {
            playerId: msg.playerId,
            name: sessionRef.current?.name || "",
          };
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessionRef.current));
        } else if (msg.type === "error") {
          setError(msg.message);
        }
      };
    });
  }, []);

  const join = useCallback(async (name: string) => {
      setError(null);
      sessionRef.current = { playerId: "", name };
      const ws = await ensureSocket();
      ws.send(JSON.stringify({ type: "join", playerName: name }));
  }, [ensureSocket]);

  const tryRejoin = useCallback(async () => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
      const saved: StoredSession = JSON.parse(raw);
      if (!saved.playerId) return false;
      sessionRef.current = saved;
      const ws = await ensureSocket();
      ws.send(JSON.stringify({ type: "rejoin", playerId: saved.playerId }));
      return true;
    } catch {
      return false;
    }
  }, [ensureSocket]);

  const start = useCallback(() => send({ type: "start" }), [send]);
  const addBot = useCallback(() => send({ type: "add_bot" }), [send]);
  const removeBot = useCallback((botId: string) => send({ type: "remove_bot", botId }), [send]);
  const play = useCallback((cards: string[]) => send({ type: "play", cards }), [send]);
  const pass = useCallback(() => send({ type: "pass" }), [send]);
  const newRound = useCallback(() => send({ type: "new_round" }), [send]);

  const leaveSession = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionRef.current = null;
    wsRef.current?.close();
    setState(null);
    setStatus("idle");
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  return { status, state, error, join, tryRejoin, start, addBot, removeBot, play, pass, newRound, leaveSession, clearError };
}