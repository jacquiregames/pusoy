from __future__ import annotations

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging
import socket
from .game import GameError
from .room_manager import manager

app = FastAPI(title="Pusoy Dos LAN Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    return {"status": "ok", "service": "pusoy-dos", "rooms": len(manager.rooms)}


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    room_code = "LAN"
    player_id: str | None = None

    try:
        while True:
            msg = await websocket.receive_json()
            msg_type = msg.get("type")

            try:
                if msg_type == "join":
                    name = (msg.get("playerName") or "").strip()[:16]
                    if not name:
                        raise GameError("Enter a name to join the table.")

                    room = manager.get_or_create_room(room_code)
                    player = room.add_player(name)
                    player_id = player.id
                    manager.register_connection(room_code, player_id, websocket)
                    await websocket.send_json({"type": "joined", "roomCode": room_code, "playerId": player_id})
                    await manager.broadcast(room_code)

                elif msg_type == "rejoin":
                    pid = msg.get("playerId")
                    room = manager.get_room(room_code)
                    if not room or not room.get_player(pid):
                        raise GameError("Couldn't rejoin — that table or seat no longer exists.")
                    room.mark_connection(pid, True)
                    player_id = pid
                    manager.register_connection(room_code, player_id, websocket)
                    await websocket.send_json({"type": "joined", "roomCode": room_code, "playerId": player_id})
                    await manager.broadcast(room_code)
                 
                elif msg_type == "add_bot":
                    room = manager.get_room(room_code)
                    if not room: raise GameError("Join a table first.")
                    player = room.get_player(player_id)
                    if not player or not player.is_host:
                        raise GameError("Only the host can add a computer player.")
                    room.add_bot()
                    await manager.broadcast(room_code)

                elif msg_type == "remove_bot":
                    room = manager.get_room(room_code)
                    if not room: raise GameError("Join a table first.")
                    player = room.get_player(player_id)
                    if not player or not player.is_host:
                        raise GameError("Only the host can remove a computer player.")
                    room.remove_bot(msg.get("botId"))
                    await manager.broadcast(room_code)

                elif msg_type == "start":
                    room = manager.get_room(room_code)
                    if not room: raise GameError("Join a table first.") 
                    player = room.get_player(player_id)
                    if not player or not player.is_host:
                        raise GameError("Only the host can start the game.")
                    room.start_game()
                    await manager.broadcast(room_code)
                    manager.trigger_bot_turns(room_code)

                elif msg_type == "play":
                    room = manager.get_room(room_code) if room_code else None
                    if not room:
                        raise GameError("Join a table first.")
                    res = room.play_cards(player_id, msg.get("cards") or [])
                    await manager.broadcast(room_code)
                    if res == "unbeatable":
                        manager.trigger_clear_delay(room_code)
                    else:
                        manager.trigger_bot_turns(room_code)

                elif msg_type == "pass":
                    room = manager.get_room(room_code) if room_code else None
                    if not room:
                        raise GameError("Join a table first.")
                    room.pass_turn(player_id)
                    await manager.broadcast(room_code)
                    manager.trigger_bot_turns(room_code)

                elif msg_type == "new_round":
                    room = manager.get_room(room_code) if room_code else None
                    if not room:
                        raise GameError("Join a table first.")
                    player = room.get_player(player_id)
                    if not player or not player.is_host:
                        raise GameError("Only the host can start a new round.")
                    room.phase = "lobby"
                    await manager.broadcast(room_code)

                else:
                    raise GameError(f"Unknown message type '{msg_type}'.")

            except GameError as e:
                await websocket.send_json({"type": "error", "message": str(e)})

    except WebSocketDisconnect:
        if room_code and player_id:
            manager.unregister_connection(room_code, player_id)
            room = manager.get_room(room_code)
            if room:
                if room.phase == "lobby":
                    room.remove_player(player_id)
                else:
                    room.mark_connection(player_id, False)
                await manager.broadcast(room_code)
                manager.maybe_delete_room(room_code)


def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(0)
    try: 
        s.connect(('10.254.254.254', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=logging.INFO)
    local_ip = get_ip()
    port = 3000
    print(f"\nPusoy Dos server starting — players on your LAN connect to: ws://{local_ip}:{port}/ws\n")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")