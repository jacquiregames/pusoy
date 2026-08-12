"""
Hand classification & comparison for Pusoy Dos.

Valid play shapes: SINGLE (1), PAIR (2), TRIPLE (3), FOUR-OF-A-KIND ALONE (4),
FIVE-CARD HAND (5). TRIPLE and FOUR-alone are house-rule additions on top of
the classic ruleset.
Five card hand categories (low -> high): STRAIGHT, FLUSH, FULL_HOUSE, FOUR_KIND, STRAIGHT_FLUSH
A four-of-a-kind plus one extra card is a FIVE-card hand (FOUR_KIND) and beats
a FULL_HOUSE, per house rules. A four-of-a-kind played by itself (no extra
card) is the separate FOUR shape below, and only compares against other bare
FOUR plays.
"""
from __future__ import annotations

from collections import Counter
from enum import IntEnum
from typing import List, Optional, Tuple

from .models import Card

SINGLE = "SINGLE"
PAIR = "PAIR"
TRIPLE = "TRIPLE"
FOUR = "FOUR"
FIVE = "FIVE"


class FiveKind(IntEnum):
    STRAIGHT = 0
    FLUSH = 1
    FULL_HOUSE = 2
    FOUR_KIND = 3
    STRAIGHT_FLUSH = 4


class HandError(ValueError):
    pass


def _is_straight(sorted_ranks: List[int]) -> bool:
    # Standard ascending straight
    if all(sorted_ranks[i] + 1 == sorted_ranks[i + 1] for i in range(len(sorted_ranks) - 1)):
        return True
    
    # Special wrap-around check for A-2-3-4-5 (Lowest straight)
    if sorted_ranks == [0, 1, 2, 11, 12]:
        return True
        
    # Special wrap-around check for 2-3-4-5-6 (Second lowest straight)
    if sorted_ranks == [0, 1, 2, 3, 12]:
        return True
        
    return False

def classify(cards: List[Card]) -> Tuple[str, Optional[FiveKind]]:
    """Returns (shape, five_kind_or_none). Raises HandError if cards don't form any valid play."""
    n = len(cards)
    if n == 1:
        return SINGLE, None
    if n == 2:
        if cards[0].rank == cards[1].rank:
            return PAIR, None
        raise HandError("A two-card play must be a pair of matching ranks.")
    if n == 3:
        if len({c.rank for c in cards}) == 1:
            return TRIPLE, None
        raise HandError("A three-card play must be three of a kind.")
    if n == 4:
        if len({c.rank for c in cards}) == 1:
            return FOUR, None
        raise HandError("A four-card play must be four of a kind.")
    if n == 5:
        ranks = sorted(c.rank_value for c in cards)
        rank_counts = Counter(c.rank for c in cards)
        counts = sorted(rank_counts.values(), reverse=True)
        is_flush = len({c.suit for c in cards}) == 1
        is_straight = _is_straight(ranks)

        if is_straight and is_flush:
            return FIVE, FiveKind.STRAIGHT_FLUSH
        if counts == [4, 1]:
            return FIVE, FiveKind.FOUR_KIND
        if counts == [3, 2]:
            return FIVE, FiveKind.FULL_HOUSE
        if is_flush:
            return FIVE, FiveKind.FLUSH
        if is_straight:
            return FIVE, FiveKind.STRAIGHT
        raise HandError("Those five cards don't form a straight, flush, full house, four of a kind, or straight flush.")
    raise HandError("A play must be 1, 2, 3, 4, or exactly 5 cards.")

def _five_card_key(cards: List[Card], kind: FiveKind) -> Tuple:
    """Comparable key for two five-card hands of the SAME kind."""
    by_rank = Counter(c.rank for c in cards)

    if kind in (FiveKind.STRAIGHT, FiveKind.STRAIGHT_FLUSH, FiveKind.FLUSH):
        ranks = sorted([c.rank_value for c in cards])
        
        # Special case straights where '2' (and sometimes 'A') acts as a low card
        if kind in (FiveKind.STRAIGHT, FiveKind.STRAIGHT_FLUSH):
            # A-2-3-4-5 (lowest straight - tiebreaker is the 5)
            if ranks == [0, 1, 2, 11, 12]:
                top = next(c for c in cards if c.rank == "5")
                return (top.rank_value, top.suit_value)
            
            # 2-3-4-5-6 (second lowest straight - tiebreaker is the 6)
            if ranks == [0, 1, 2, 3, 12]:
                top = next(c for c in cards if c.rank == "6")
                return (top.rank_value, top.suit_value)
        
        # Standard flush or standard straight (where the mathematically highest value card is truly the top)
        top = max(cards, key=lambda c: c.value)
        return (top.rank_value, top.suit_value)

    if kind == FiveKind.FULL_HOUSE:
        triple_rank = [r for r, cnt in by_rank.items() if cnt == 3][0]
        return (RANK_VALUE_OF(triple_rank),)

    if kind == FiveKind.FOUR_KIND:
        quad_rank = [r for r, cnt in by_rank.items() if cnt == 4][0]
        return (RANK_VALUE_OF(quad_rank),)

    raise HandError("Unknown five card hand kind.")

def RANK_VALUE_OF(rank: str) -> int:
    from .models import RANK_VALUE
    return RANK_VALUE[rank]

def compare(play_a: List[Card], play_b: List[Card]) -> int:
    """Compare play_a vs play_b (must be the same shape/size). Returns >0 if a beats b."""
    shape_a, kind_a = classify(play_a)
    shape_b, kind_b = classify(play_b)
    if shape_a != shape_b or len(play_a) != len(play_b):
        raise HandError("Cannot compare plays of different shapes.")

    if shape_a in (SINGLE, PAIR):
        val_a = max(c.value for c in play_a)
        val_b = max(c.value for c in play_b)
        return val_a - val_b

    if shape_a in (TRIPLE, FOUR):
        # all cards share one rank by construction; compare that rank directly
        rank_a, rank_b = play_a[0].rank_value, play_b[0].rank_value
        if rank_a != rank_b:
            return rank_a - rank_b
        # ranks can't actually repeat within one deck's worth of live cards,
        # but break ties defensively by highest suit present
        return max(c.suit_value for c in play_a) - max(c.suit_value for c in play_b)

    # FIVE card hands: category first, then in-category key
    if kind_a != kind_b:
        return int(kind_a) - int(kind_b)
    key_a = _five_card_key(play_a, kind_a)
    key_b = _five_card_key(play_b, kind_b)
    return (key_a > key_b) - (key_a < key_b)


def beats(play: List[Card], previous: List[Card]) -> bool:
    """Whether `play` is a legal play on top of `previous` (same shape, strictly higher)."""
    if len(play) != len(previous):
        return False
    try:
        return compare(play, previous) > 0
    except HandError:
        return False


def is_unbeatable(cards: List[Card]) -> bool:
    """
    Whether this play is mathematically guaranteed to never be beaten by any
    legal same-shape play, given there's only one of each card in the deck.
    Only defined for non-five-card shapes (SINGLE/PAIR/TRIPLE/FOUR) - callers
    should not apply this to FIVE-card hands, which are excluded by house rule
    from the auto-return-turn QoL feature even when they'd technically qualify
    (e.g. a straight flush).
    """
    shape, _ = classify(cards)

    if shape == SINGLE:
        # The 2 of Diamonds is the single highest-value card in the deck.
        card = cards[0]
        return card.rank == "2" and card.suit == "D"

    if shape == PAIR:
        # A pair of 2's that includes the 2 of Diamonds has the highest
        # possible card in it, so no other pair can ever out-value it.
        return cards[0].rank == "2" and any(c.suit == "D" for c in cards)

    if shape in (TRIPLE, FOUR):
        # Rank "2" is the highest rank, and there are only four 2's in the
        # deck. Once a player holds 3 or 4 of them, no other player can ever
        # assemble a second triple/four of 2's to challenge it.
        return cards[0].rank == "2"

    return False

