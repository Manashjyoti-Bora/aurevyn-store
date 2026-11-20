/**
 * Route-enter motion. `template.tsx` remounts on every navigation, so the
 * class replays once per route change — a 380 ms dissolve that makes page
 * changes feel composed rather than abrupt. Opacity only: a transform here
 * would make the wrapper a containing block and unstick any `position: fixed`
 * descendant (chapter rail, overlays). The global reduced-motion block
 * neutralises it.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
