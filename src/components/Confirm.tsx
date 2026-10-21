"use client";
// A yes/no question in a notched pixel box (overwrite the save, leave the game). Esc = no; arrows switch buttons.
import { useEffect, useRef } from "react";
import { WARN } from "@/game/sprites";
import s from "./game.module.css";
import { PixelButton, Pix } from "./ui";

export function Confirm({
  title,
  text,
  yes,
  no,
  onYes,
  onNo,
  focusNo = false,
  warn = false,
}: {
  title: string;
  text: string;
  yes: string;
  no: string;
  onYes: () => void;
  onNo: () => void;
  /** Start on the safe answer (when YES throws something away). */
  focusNo?: boolean;
  warn?: boolean;
}) {
  const yesRef = useRef<HTMLButtonElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    (focusNo ? noRef : yesRef).current?.focus({ preventScroll: true });
  }, [focusNo]);

  return (
    <div
      className={s.confirmBackdrop}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-text"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onNo();
        } else if (
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab"].includes(
            e.key,
          )
        ) {
          // Two buttons: every move just swaps between them (and keeps focus inside the box).
          e.preventDefault();
          (document.activeElement === yesRef.current
            ? noRef
            : yesRef
          ).current?.focus();
        } else if (e.repeat && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
        }
      }}
    >
      <div className={`${s.confirmBox} ${warn ? s.confirmWarn : ""}`}>
        <div className={s.confirmOuter}>
          <div className={s.confirmInner}>
            <h2 id="confirm-title" className={s.confirmTitle}>
              {warn ? <Pix sprite={WARN} scale={3} /> : null}
              {title}
            </h2>
            <p id="confirm-text" className={s.confirmText}>
              {text}
            </p>
            <div className={s.confirmButtons}>
              <PixelButton variant="dim" ref={noRef} onClick={onNo}>
                {no}
              </PixelButton>
              <PixelButton
                variant={warn ? "red" : "yellow"}
                ref={yesRef}
                onClick={onYes}
              >
                {yes}
              </PixelButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
