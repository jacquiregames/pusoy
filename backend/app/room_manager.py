from __future__ import annotations
import asyncio
import random
from typing import Dict, Optional
from fastapi import WebSocket
from .game import GameError, GameRoom

class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, GameRoom] = {}
        self.connections: Dict[str, Dict[str, WebSocket]] = {}
        self.bot_tasks: Dict[str, asyncio.Task] = {}

    def get_or_create_room(self, code: str = "LAN") -> GameRoom:
        if code not in self.rooms:
            self.rooms[code] = GameRoom(code)
            self.connections[code] = {}
        return self.rooms[code]

    def get_room(self, code: str = "LAN") -> Optional[GameRoom]:
        return self.rooms.get(code)

    def register_connection(self, room_code: str, player_id: str, ws: WebSocket):
        self.connections.setdefault(room_code, {})[player_id] = ws

    def unregister_connection(self, room_code: str, player_id: str):
        if room_code in self.connections:
            self.connections[room_code].pop(player_id, None)

    async def broadcast(self, room_code: str = "LAN"):
        room = self.rooms.get(room_code)
        if not room:
            return
        conns = self.connections.get(room_code, {})
        dead = []
        for pid, ws in conns.items():
            try:
                await ws.send_json(room.state_for(pid))
            except Exception:
                dead.append(pid)
        for pid in dead:
            conns.pop(pid, None)

    def trigger_bot_turns(self, room_code: str = "LAN"):
        """Kick off (if not already running) a background loop that plays
        out every consecutive computer-player turn, broadcasting after each
        one, until it's a human's turn again or the game ends."""
        existing = self.bot_tasks.get(room_code)
        if existing and not existing.done():
            return
        self.bot_tasks[room_code] = asyncio.create_task(self._run_bot_turns(room_code))

    async def _run_bot_turns(self, room_code: str):
        while True:
            room = self.rooms.get(room_code)
            if not room or room.phase != "playing" or not room.players:
                return
            current = room.current_player()
            if not current.is_bot:
                return

            # A little "thinking" delay so bot turns don't feel instant.
            await asyncio.sleep(random.uniform(0.9, 1.6))

            room = self.rooms.get(room_code)
            if not room or room.phase != "playing":
                return
            current = room.current_player()
            if not current.is_bot:
                return
                
            # If the bot is waiting for its unbeatable trick to clear...
            if room.last_play_player_id == current.id:
                return

            try:
                res = room.bot_take_turn(current.id)
            except GameError:
                # Shouldn't happen in practice; bail out rather than loop forever.
                return
            await self.broadcast(room_code)
            
            if res == "unbeatable":
                self.trigger_clear_delay(room_code)
                return

    def trigger_clear_delay(self, room_code: str):
        asyncio.create_task(self._clear_delay_task(room_code))

    async def _clear_delay_task(self, room_code: str):
        await asyncio.sleep(2)
        room = self.rooms.get(room_code)
        if room and room.phase == "playing":
            # clear the trick if it's still theirs
            if room.last_play_player_id is not None and room.last_play_player_id == room.current_player().id:
                room.last_play = None
                room.last_play_player_id = None
                room.pass_count = 0
                await self.broadcast(room_code)
                self.trigger_bot_turns(room_code)

    def maybe_delete_room(self, room_code: str = "LAN"):
        room = self.rooms.get(room_code)
        if not room:
            return
        conns = self.connections.get(room_code, {})
        has_human = any(not p.is_bot for p in room.players)
        if not conns and not has_human:
            self.rooms.pop(room_code, None)
            self.connections.pop(room_code, None)
            task = self.bot_tasks.pop(room_code, None)
            if task and not task.done():
                task.cancel()

manager = RoomManager()
