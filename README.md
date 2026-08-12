# 🃏 Pusoy 

A fast, fluid, and visually juicy web-based implementation of **Pusoy Dos** (Filipino Big Two), designed specifically for local network (LAN) multiplayer. Grab your friends, connect to the same Wi-Fi, and start dropping power plays.

## ✨ Features

- **LAN-Party Ready:** Hosted locally. The backend auto-detects your local IP and serves the game seamlessly to anyone on your network.
- **3 or 4 Player Modes:** Dynamically supports 3-player (17 cards each) or standard 4-player (13 cards each) modes.
- **Fluid & Juicy UI:**
  - Dynamic 3D card physics, perspective flips, and motion blur.
  - Screen shake, dust impacts, and shockwave animations for "Power Plays" (Four-of-a-Kind, Flushes, etc.).
  - Smooth FLIP animations when sorting your hand by Rank or Suit.
- **Real-time Multiplayer:** Built on lightning-fast WebSockets. Includes a live "Table Talk" game log to track who plays what (and who is passing).
- **Session Recovery:** Accidentally closed your browser? The game uses session storage to safely drop you right back into your seat.
- **Customizable:** Toggle between different felt table backgrounds on the fly.

## 🛠️ Tech Stack

**Frontend:**
- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) (Configured to broadcast on `0.0.0.0` for LAN access)
- Pure custom CSS (No heavy UI component libraries; features custom keyframe animations and 3D transforms).

**Backend:**
- [Python 3](https://python.org/) + [FastAPI](https://fastapi.tiangolo.com/)
- Native WebSockets for low-latency state synchronization.
- Custom robust shedding-game logic engine.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+) and `pnpm` (or `npm`/`yarn`)
- **Python 3.9+**

### 1. Installation

Clone the repository and install the dependencies for both the frontend and backend:

```bash
# Install frontend dependencies
pnpm install

# Install backend dependencies
pip install -r backend/requirements.txt

2. Assets (Playing Cards)

Ensure your playing card images are placed in the public/Cards/ directory. The game expects PNG files formatted as [rank]_of_[suit].png (e.g., ace_of_spades.png, 10_of_diamonds.png) and a cardback.png file.
3. Running the Game

On Linux (GNOME):
You can use the provided bash script to launch both the frontend and backend in separate terminal windows automatically:
code Bash

chmod +x pusoy.sh
./pusoy.sh

Manual Start (Windows/Mac/Linux):
Open two terminal windows.

Terminal 1 (Backend):
code Bash

python3 -m backend.app.main

(The console will print out the local IP address for your friends to connect to!)

Terminal 2 (Frontend):
code Bash

pnpm run dev

4. How to Play

    Look at the terminal output from Vite. It will provide a Network URL (e.g., http://192.168.1.X:5173).

    Have your friends type that exact URL into their mobile or desktop browsers.

    Enter your names, join the lobby, and the first person to join acts as the host to deal the cards.

📜 Game Rules (House Rules Implemented)

This engine implements standard Pusoy Dos rules with a few specific house variants for maximum fun:

    Card Ranking: 3 (Lowest) ➔ 4 ➔ 5 ➔ ... ➔ K ➔ A ➔ 2 (Highest)

    Suit Ranking: Clubs ♣ (Lowest) ➔ Spades ♠ ➔ Hearts ♥ ➔ Diamonds ♦ (Highest)

    Valid Plays:

        Single: Any single card.

        Pair: Two cards of the same rank.

        Triple: Three cards of the same rank. (House Rule)

        Four-of-a-Kind (Standalone): Four cards of the same rank. (House Rule)

        Five-Card Hands: Straight, Flush, Full House, Four-of-a-kind + Kicker, Straight Flush.

    Leading: The player holding the absolute lowest card (usually the 3 of Clubs) leads the very first trick and must include that card in their opening play.

    Winning: The first player to successfully shed all their cards wins the round!

📂 Project Structure
code Text

├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI & WebSocket entry point
│   │   ├── game.py          # Room & Turn state machine
│   │   ├── hands.py         # Card classification & comparison logic
│   │   ├── models.py        # Card dataclasses
│   │   └── room_manager.py  # WebSocket connection routing
│   └── requirements.txt
├── public/
│   ├── Cards/               # PNG card assets
│   ├── table1.png           # Table background 1
│   ├── table2.png           # Table background 2
│   └── turn.png             # Active turn indicator
├── src/
│   ├── api/                 # React WebSocket hooks
│   ├── components/          # React UI (PlayArea, Lobby, Cards)
│   ├── styles/              # Global CSS & Variables
│   ├── types.ts             # Shared TypeScript definitions
│   └── App.tsx              # Main frontend router/wrapper
├── pusoy.sh                 # Startup script
├── vite.config.ts
└── package.json

🤝 Contributing

Feel free to open an issue or submit a pull request if you want to add new house rules, new animations, or fix bugs!
📄 License

This project is open-source and available under the MIT License.
