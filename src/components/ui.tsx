// Small shared building blocks: pixel sprite, notched panel, notched button.
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { spriteSize, spriteUrl, type Sprite } from "@/game/sprites";
import s from "./game.module.css";

export function Pix({
  sprite,
  scale = 3,
  alt = "",
  className,
  style,
}: {
  sprite: Sprite;
  scale?: number;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const { w, h } = spriteSize(sprite);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny inline SVG data URLs; next/image adds nothing here
    <img
      src={spriteUrl(sprite)}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={w * scale}
      height={h * scale}
      className={className}
      style={style}
      draggable={false}
    />
  );
}

/** Small pixel "i" button: reopens that panel's explanation. The 40px tap target comes from padding that a negative
 * margin gives back, so it doesn't push the title or label around. */
export function InfoButton({
  name,
  onClick,
}: {
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={s.infoBtn}
      aria-label={`What is ${name}?`}
      title={`What is ${name}?`}
      onClick={onClick}
    >
      <span className={s.infoOuter}>
        <span className={s.infoInner}>i</span>
      </span>
    </button>
  );
}

export function Panel({
  title,
  children,
  className,
  innerClassName,
  tut,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  /** Tutorial spotlight key (data-tut), see src/game/tutorial.ts. */
  tut?: string;
}) {
  return (
    <section className={`${s.panelWrap} ${className ?? ""}`} data-tut={tut}>
      {title ? <h2 className={s.panelTitle}>{title}</h2> : null}
      <div className={s.frame} aria-hidden>
        <div className={s.frameInner} />
      </div>
      <div className={`${s.panelBody} ${innerClassName ?? ""}`}>{children}</div>
    </section>
  );
}

export type BtnVariant = "green" | "red" | "pink" | "blue" | "yellow" | "dim";

export function PixelButton({
  variant = "green",
  children,
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: BtnVariant }) {
  return (
    <button
      type="button"
      className={`${s.btn} ${variant === "green" ? "" : s[variant]} ${className ?? ""}`}
      {...rest}
    >
      <span className={s.btnOuter}>
        <span className={s.btnInner}>{children}</span>
      </span>
    </button>
  );
}
