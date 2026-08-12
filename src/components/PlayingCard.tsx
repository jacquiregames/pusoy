import type { CSSProperties } from "react";
import type { CardData } from "../types";
import "./PlayingCard.css";

interface Props {
  card?: CardData;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
}

export default function PlayingCard({ card, faceDown, selected, disabled, size = "md", style, className = "", onClick }: Props) {
  const isBack = faceDown || !card;

  const getCardImage = () => {
    if (isBack) return "/cards/cardback.png";
    const suitName = { D: "diamonds", C: "clubs", H: "hearts", S: "spades" }[card.suit];
    const rankName = { A: "ace", J: "jack", Q: "queen", K: "king" }[card.rank] || card.rank;
    return `/cards/${rankName}_of_${suitName}.png`;
  };

  const imgContent = (
    <img 
      src={getCardImage()} 
      alt={isBack ? "Card Back" : `${card?.rank} of ${card?.suit}`} 
      className="p-card__image" 
      draggable={false} 
    />
  );

  const baseClassName = [
    "p-card",
    `p-card--${size}`,
    selected ? "p-card--selected" : "",
    disabled ? "p-card--disabled" : "",
    className
  ].filter(Boolean).join(" ");

  if (isBack && !onClick) {
    return (
      <div className={baseClassName} style={style}>
        {imgContent}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={baseClassName}
      style={style}
      disabled={disabled}
      onClick={onClick}
      data-card-code={card?.code}
    >
      {imgContent}
    </button>
  );
}