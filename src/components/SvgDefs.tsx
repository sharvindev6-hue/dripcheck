/**
 * Document-level SVG gradients used by every mannequin and garment flat.
 * Defined once so the renderers can reference `url(#gav)` / `url(#gfl)`
 * without duplicating ids in every card.
 */
export default function SvgDefs() {
  return (
    <svg className="sr" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gfl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".24" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
        <linearGradient id="gav" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="200" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".2" />
          <stop offset=".42" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".26" />
        </linearGradient>
      </defs>
    </svg>
  )
}
