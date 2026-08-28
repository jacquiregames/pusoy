from __future__ import annotations

import itertools
import random
import time
import uuid
from dataclasses import dataclass, field
from functools import cmp_to_key
from typing import Dict, List, Optional

from .hands import FIVE, HandError, beats, classify, compare, is_unbeatable
from .models import Card, build_deck


class GameError(ValueError):
    pass

@dataclass
class Player:
    id: str
    name: str
    seat: int
    hand: List[Card] = field(default_factory=list)
    connected: bool = True
    finished_rank: Optional[int] = None
    is_host: bool = False
    is_bot: bool = False

    def public_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "seat": self.seat,
            "cardCount": len(self.hand),
            "connected": self.connected,
            "finishedRank": self.finished_rank,
            "isHost": self.is_host,
            "isBot": self.is_bot,
        }


class GameRoom:
    MAX_LOG = 40

    def __init__(self, code: str):
        self.code = code
        self.mode: Optional[int] = None  # Always 3
        self.players: List[Player] = []
        self.phase = "lobby"  # lobby | playing | finished
        self.current_turn_idx = 0
        self.last_play: Optional[List[Card]] = None
        self.last_play_player_id: Optional[str] = None
        self.pass_count = 0
        self.any_play_made = False
        self.finished_order: List[str] = []
        self.log: List[dict] = []
        self.created_at = time.time()

    # ---------- lobby management ----------

    def add_player(self, name: str) -> Player:
        if self.phase != "lobby":
            raise GameError("Game already in progress.")
        if len(self.players) >= 3:
            raise GameError("Room is full.")
        if any(p.name.lower() == name.lower() for p in self.players):
            raise GameError("That name is already taken in this room.")
        player = Player(id=str(uuid.uuid4()), name=name, seat=len(self.players))
        if not self.players:
            player.is_host = True
        self.players.append(player) 
        return player

    def add_bot(self) -> Player:
        if self.phase != "lobby":
            raise GameError("Game already in progress.")
        if len(self.players) >= 3:
            raise GameError("Room is full.")
        bot_number = sum(1 for p in self.players if p.is_bot) + 1
        player = Player(id=f"bot-{uuid.uuid4()}", name=f"Bot{bot_number}", seat=len(self.players), is_bot=True)
        self.players.append(player)
        return player

    def remove_bot(self, player_id: str):
        if self.phase != "lobby":
            raise GameError("Can't remove a computer player once the game has started.")
        player = self.get_player(player_id)
        if not player or not player.is_bot:
            raise GameError("That seat isn't a computer player.")
        self.remove_player(player_id)

    def remove_player(self, player_id: str):
        self.players = [p for p in self.players if p.id != player_id]
        for i, p in enumerate(self.players):
            p.seat = i
        if self.players and not any(p.is_host for p in self.players):
            self.players[0].is_host = True

    def mark_connection(self, player_id: str, connected: bool):
        for p in self.players:
            if p.id == player_id:
                p.connected = connected

    def get_player(self, player_id: str) -> Optional[Player]:
        return next((p for p in self.players if p.id == player_id), None)

    # ---------- dealing ----------

    def start_game(self):
        if len(self.players) != 3:
            raise GameError("Need exactly 3 players to start.")

        deck = build_deck()
        random.shuffle(deck)
        hand_size = 17
        for p in self.players:
            p.hand = sorted(deck[: hand_size], key=lambda c: c.value)
            deck = deck[hand_size:]

        self.mode = 3
        self.phase = "playing"
        self.last_play = None
        self.last_play_player_id = None
        self.pass_count = 0
        self.any_play_made = False
        self.finished_order = []
        for p in self.players:
            p.finished_rank = None

        # whoever holds the globally lowest dealt card leads first
        lowest_player_idx = 0
        lowest_value = None
        for i, p in enumerate(self.players):
            m = min(c.value for c in p.hand)
            if lowest_value is None or m < lowest_value:
                lowest_value = m
                lowest_player_idx = i
        self.current_turn_idx = lowest_player_idx
        self._push_log("system", f"Cards dealt. {self.players[lowest_player_idx].name} leads the first trick.")

    # ---------- turn helpers ----------

    def _unfinished_players(self) -> List[Player]:
        return [p for p in self.players if p.finished_rank is None]

    def _next_unfinished_idx(self, from_idx: int) -> int:
        n = len(self.players)
        for step in range(1, n + 1):
            idx = (from_idx + step) % n
            if self.players[idx].finished_rank is None:
                return idx
        return from_idx

    def current_player(self) -> Player:
        return self.players[self.current_turn_idx]

    def _push_log(self, kind: str, message: str, **extra):
        entry = {"type": kind, "message": message, "ts": time.time(), **extra}
        self.log.append(entry)
        self.log = self.log[-self.MAX_LOG :]

    # ---------- gameplay ----------

    def play_cards(self, player_id: str, card_codes: List[str]):
        if self.phase != "playing":
            raise GameError("Game isn't in progress.")
        player = self.get_player(player_id)
        if player is None:
            raise GameError("Unknown player.")
        if self.current_player().id != player_id:
            raise GameError("It isn't your turn.")
        if not card_codes:
            raise GameError("Select at least one card to play.")

        try:
            cards = [Card.from_code(c) for c in card_codes]
        except Exception:
            raise GameError("Malformed card selection.")

        hand_codes = {c.code(): c for c in player.hand}
        for c in cards:
            if c.code() not in hand_codes:
                raise GameError("You don't hold one of the selected cards.")
        if len({c.code() for c in cards}) != len(cards):
            raise GameError("Duplicate card in selection.")

        try:
            shape, _ = classify(cards)
        except HandError as e:
            raise GameError(str(e))

        is_free_lead = self.last_play is None

        if not self.any_play_made:
            all_in_play_cards = [c for c in player.hand] + [c for pl in self.players if pl.id != player_id for c in pl.hand]
            lowest_card = min(all_in_play_cards, key=lambda c: c.value)
            if lowest_card.code() not in {c.code() for c in cards}:
                raise GameError(f"The very first play of the game must include {_card_label(lowest_card)}.")

        if not is_free_lead:
            if len(cards) != len(self.last_play):
                raise GameError(f"You must play exactly {len(self.last_play)} card(s) to match the last play.")
            if not beats(cards, self.last_play):
                raise GameError("That doesn't beat the last play.")
        else:
            # leading a fresh trick: shape just needs to be valid (already checked by classify)
            pass

        # commit
        player.hand = [c for c in player.hand if c.code() not in {x.code() for x in cards}]
        self.last_play = cards
        self.last_play_player_id = player_id
        self.pass_count = 0
        self.any_play_made = True
        self._push_log("play", f"{player.name} played {', '.join(_card_label(c) for c in cards)}", playerId=player.id, cards=[c.code() for c in cards])

        just_finished = False
        if not player.hand:
            player.finished_rank = len(self.finished_order) + 1
            self.finished_order.append(player.id)
            just_finished = True
            self._push_log("finish", f"{player.name} finished #{player.finished_rank}!", playerId=player.id)
            remaining = self._unfinished_players()
            if len(remaining) == 1:
                last_p = remaining[0]
                last_p.finished_rank = len(self.finished_order) + 1
                self.finished_order.append(last_p.id)
                self.phase = "finished"
                self._push_log("finish", f"{last_p.name} finishes last.", playerId=last_p.id)
                return
        elif shape != FIVE and is_unbeatable(cards):
            self.last_play = None
            self.last_play_player_id = None
            self.pass_count = 0
            self._push_log(
                "unbeatable",
                f"{player.name}'s play can't be beaten — turn comes right back to them.",
                playerId=player.id,
                cards=[c.code() for c in cards],
            )
            return
        self.current_turn_idx = self._next_unfinished_idx(self.current_turn_idx)

    # ---------- computer players ----------

    def bot_take_turn(self, player_id: str):
        player = self.get_player(player_id)
        if not player or not player.is_bot:
            raise GameError("Not a computer player.")
        if self.phase != "playing":
            raise GameError("Game isn't in progress.")
        if self.current_player().id != player_id:
            raise GameError("It isn't this bot's turn.")

        play = self._choose_bot_play(player)
        if play is None:
            self.pass_turn(player_id)
        else:
            self.play_cards(player_id, [c.code() for c in play])

    def _choose_bot_play(self, player: Player) -> Optional[List[Card]]:
        if self.last_play is None:
            candidates: List[List[Card]] = []
            candidates.extend([[c] for c in player.hand])
            by_rank: Dict[str, List[Card]] = {}
            for c in player.hand:
                by_rank.setdefault(c.rank, []).append(c)
                
            for group in by_rank.values():
                n = len(group)
                if n >= 2: candidates.extend(list(combo) for combo in itertools.combinations(group, 2))
                if n >= 3: candidates.extend(list(combo) for combo in itertools.combinations(group, 3))
                if n == 4: candidates.append(list(group))
                
            if len(player.hand) >= 5:
                for combo in itertools.combinations(player.hand, 5):
                    try:
                        if classify(list(combo))[0] == FIVE:
                            candidates.append(list(combo))
                    except HandError:
                        pass
                        
            if not self.any_play_made:
                lowest_card = min(player.hand, key=lambda c: c.value)
                candidates = [c for c in candidates if lowest_card.code() in {x.code() for x in c}]
                
            lengths_available = list({len(c) for c in candidates})
            chosen_len = random.choice(lengths_available)
            options = [c for c in candidates if len(c) == chosen_len]
            options.sort(key=cmp_to_key(compare))
            return options[0]

        required = len(self.last_play)
        if len(player.hand) < required:
            return None

        candidates: List[List[Card]] = []
        if required <= 4:
            by_rank: Dict[str, List[Card]] = {}
            for c in player.hand:
                by_rank.setdefault(c.rank, []).append(c)
            for group in by_rank.values():
                if len(group) < required:
                    continue
                candidates.extend(list(combo) for combo in itertools.combinations(group, required))
        else:
            candidates.extend(list(combo) for combo in itertools.combinations(player.hand, 5))

        winners = [c for c in candidates if beats(c, self.last_play)]
        if not winners:
            return None
        winners.sort(key=cmp_to_key(compare))
        return winners[0]

    def pass_turn(self, player_id: str):
        if self.phase != "playing":
            raise GameError("Game isn't in progress.")
        if self.current_player().id != player_id:
            raise GameError("It isn't your turn.")
        if self.last_play is None:
            raise GameError("You're leading the trick — you must play a hand.")

        player = self.get_player(player_id)
        self.pass_count += 1
        self._push_log("pass", f"{player.name} passed.", playerId=player.id)

        unfinished_count = len(self._unfinished_players())
        winner_id = self.last_play_player_id
        self.current_turn_idx = self._next_unfinished_idx(self.current_turn_idx)

        if self.pass_count >= unfinished_count - 1:
            self.last_play = None
            self.last_play_player_id = None
            self.pass_count = 0
            winner = self.get_player(winner_id)
            if winner and winner.finished_rank is None:
                self.current_turn_idx = self.players.index(winner)
            self._push_log("system", f"Everyone passed. {winner.name if winner else ''} leads a new trick.")

    # ---------- serialization ----------

    def state_for(self, viewer_id: str) -> dict:
        viewer = self.get_player(viewer_id)
        return {
            "type": "state",
            "roomCode": self.code,
            "mode": self.mode,
            "phase": self.phase,
            "players": [p.public_dict() for p in self.players],
            "yourHand": [c.to_dict() for c in (viewer.hand if viewer else [])],
            "yourId": viewer_id,
            "currentTurnPlayerId": self.current_player().id if self.players and self.phase == "playing" else None,
            "lastPlay": None
            if not self.last_play
            else {
                "playerId": self.last_play_player_id,
                "cards": [c.to_dict() for c in self.last_play],
            },
            "passCount": self.pass_count,
            "finishedOrder": self.finished_order,
            "log": self.log[-15:],
        }


def _card_label(card: Card) -> str:
    suit_symbol = {"D": "♦", "C": "♣", "H": "♥", "S": "♠"}[card.suit]
    return f"{card.rank}{suit_symbol}"