import { useEffect } from "react";
import { useGameSocket } from "./api/useGameSocket";
import { JoinScreen, RoomLobby } from "./components/Lobby";
import GameTable from "./components/GameTable";
import Toast from "./components/Toast";
import "./styles/global.css";

export default function App() {
  const { status, state, error, join, tryRejoin, start, addBot, removeBot, play, pass, newRound, leaveSession, clearError } =
    useGameSocket();

  useEffect(() => {
    tryRejoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) {
    return (
      <>
        <JoinScreen status={status} onJoin={join} />
        <Toast message={error} onDismiss={clearError} />
      </>
    );
  }

  return (
    <>
      {state.phase === "lobby" ? (
        <RoomLobby state={state} onStart={start} onAddBot={addBot} onRemoveBot={removeBot} onLeave={leaveSession} />
      ) : (
        <GameTable state={state} onPlay={play} onPass={pass} onNewRound={newRound} onLeave={leaveSession} />
      )}
      <Toast message={error} onDismiss={clearError} />
    </>
  );
}

