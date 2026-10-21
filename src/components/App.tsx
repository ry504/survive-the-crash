"use client";
// Front door (spec §9b): the title screen, then the game. Owns the first-gesture audio unlock for both.
import { useEffect, useState } from "react";
import * as sound from "@/game/sound";
import { initialState, type UiState } from "@/game/store";
import Game from "./Game";
import { Title, type StartMode } from "./Title";

type Screen =
  | { kind: "title"; back: boolean }
  | { kind: "game"; id: number; initial: UiState; tutorial: boolean };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "title", back: false });

  // Sound (spec §8c): nothing plays until the first gesture; the saved mute choice is read after mount.
  useEffect(() => {
    sound.loadMuted();
    const unlock = () => sound.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const start = (m: StartMode) =>
    setScreen({
      kind: "game",
      id: Date.now(),
      initial: m.kind === "continue" ? m.st : initialState(),
      tutorial: m.kind === "new" && m.tutorial,
    });

  return screen.kind === "title" ? (
    <Title skipPress={screen.back} onStart={start} />
  ) : (
    <Game
      key={screen.id}
      initial={screen.initial}
      tutorial={screen.tutorial}
      onMenu={() => setScreen({ kind: "title", back: true })}
    />
  );
}
