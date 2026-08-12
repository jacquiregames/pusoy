"""
Core card models for Pusoy Dos (Filipino Big Two).

Rank order (low -> high):  3 4 5 6 7 8 9 10 J Q K A 2
Suit order (low -> high):  Clubs < Spades < Hearts < Diamonds
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"]
SUITS = ["C", "S", "H", "D"]  # Clubs, Spades, Hearts, Diamonds

RANK_VALUE = {r: i for i, r in enumerate(RANKS)}
SUIT_VALUE = {s: i for i, s in enumerate(SUITS)}

@dataclass(frozen=True)
class Card:
    rank: str
    suit: str

    @property
    def value(self) -> int:
        """Total order value used to compare singles / pairs. Higher wins."""
        return RANK_VALUE[self.rank] * 4 + SUIT_VALUE[self.suit]

    @property
    def rank_value(self) -> int:
        return RANK_VALUE[self.rank]

    @property
    def suit_value(self) -> int:
        return SUIT_VALUE[self.suit]

    def code(self) -> str:
        """Short code e.g. 'AS', '10D', '2C' used on the wire and for card art lookup."""
        return f"{self.rank}{self.suit}"

    def to_dict(self) -> dict:
        return {"rank": self.rank, "suit": self.suit, "code": self.code(), "value": self.value}

    @staticmethod
    def from_code(code: str) -> "Card":
        suit = code[-1]
        rank = code[:-1]
        return Card(rank=rank, suit=suit)


def build_deck() -> List[Card]:
    return [Card(rank=r, suit=s) for r in RANKS for s in SUITS]


LOWEST_CARD = Card(rank="3", suit="C")  # 3 of Clubs - lowest possible card