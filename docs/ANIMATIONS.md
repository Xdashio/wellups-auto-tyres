# Well Lups · Motion Spec

Animations added to `prototype/welllups.html`. Goal: catch the eye, never slow the visitor down.

## The three pieces

| Where | Name | What happens |
|---|---|---|
| Hero | **Roll-in & Settle** | Wheel rolls in from the right edge, spinning at exactly the speed it travels (rotation = distance ÷ radius), overshoots, rocks back and settles on the hero's bottom edge. The featured card then unpacks beside it. Plays once. |
| Under fit-finder (`#featured`) | **Wheel Carousel** | Top tyres sit on a giant wheel. Drag, swipe, arrow buttons or ← → keys turn it; each tyre spins as it goes. Cards are cloned from the catalog grid, so there is one source of truth. |
| Above footer (`#roadScene`) | **Road Drive** | Wheel drives right on a fixed spot while three skyline layers slide left at different speeds (parallax) and road markings move at wheel speed. Cruises gently; scrolling the page makes it accelerate and the wheel blurs. The road surface is the footer's navy, so the page ends on the road. |

## Speed rules (keep these when porting)

1. Animate only `transform` and `opacity`. No layout or paint properties, no live `filter: blur`.
2. Motion blur is a **pre-made blurred image** (`hero-wheel-blur.webp`) cross-faded by opacity.
3. One `requestAnimationFrame` loop per effect, and it **sleeps** when idle: carousel runs only while moving, road scene only while on screen (IntersectionObserver) and tab visible.
4. Images are compressed: hero wheel 77 KB, blur 43 KB, product photos ~36 KB each (were ~1.2 MB PNGs).
5. `prefers-reduced-motion` renders a still, complete layout.
6. Wheel is a flat photo rotated in 2D. No WebGL needed.

## Tuning knobs (all in the `<script>` at the bottom)

- Hero: `D1` roll-in seconds (1.15), `OV` overshoot (5% of wheel width), spring `6.5` damping / `11` frequency.
- Carousel: `STEP` degrees between cards (14, mobile 21), `RR` wheel radius (1300), spring constants `130` / `17`.
- Road: `BASE` cruise speed px/s (150), layer `data-f` parallax factors (0.12 / 0.32 / 0.7), scroll boost `0.7`.

## Porting to the Next.js build

- Hero + Road: a client component with `useRef` and a small `useRafLoop` hook (the `loop()` helper is ~8 lines). Framer Motion's `useSpring` can replace the hand-written settle if preferred; keep rotation derived from x.
- Carousel: client component; map product data instead of cloning DOM; same pivot/rotation maths.
- Load the wheel with `next/image` (`priority` on the hero), keep the blur twin as a plain `<img>`.

## Placeholders to replace

- Hero card content (Pirelli P Zero, KES 26,400) and every tyre photo: all use the same stand-in wheel image.
- Copy: "Top picks, on a roll." and "Fitted right. Ready for every road ahead."
- Road skyline (`images/road-*.svg`) is generic with a KICC-style tower; swap for real illustration if desired.
