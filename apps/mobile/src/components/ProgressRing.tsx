import type { ReactNode } from "react"
import { Text, View, type ViewStyle } from "react-native"
import { useTokens } from "../design/tokens"

export type ProgressRingProps = {
  /** 0–100. */
  value: number
  size?: number
  stroke?: number
  label?: string | number
  caption?: string
}

/**
 * Circular score gauge.
 *
 * `react-native-svg` is not a dependency, so the arc is composed from clipped
 * circle borders instead of a `<path>`:
 *
 * - a half-width window clipped to one side of the ring yields exactly a 180°
 *   semicircle,
 * - nesting a second, rotated window intersects the two visible wedges.
 *
 * For a target sweep of `d` degrees clockwise from 12 o'clock:
 *   - `d ≤ 180`: one right-hand window holding an arc rotated by `d - 180`
 *     (intersection `[d-180, d] ∩ [0, 180] = [0, d]`),
 *   - `d > 180`: the full right semicircle `[0, 180]` plus a left-hand window
 *     holding an arc rotated by `d - 180` (`[d-180, d] ∩ [180, 360] = [180, d]`).
 *
 * Nothing here animates, so it is safe for reduced-motion users by default.
 */
export function ProgressRing({
  value,
  size = 132,
  stroke = 12,
  label,
  caption,
}: ProgressRingProps) {
  const tokens = useTokens()
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  const sweep = (clamped / 100) * 360

  const color =
    clamped >= 70 ? tokens.c.success : clamped >= 40 ? tokens.c.warning : tokens.c.danger

  const box: ViewStyle = { position: "absolute", top: 0, left: 0, width: size, height: size }

  const window = (side: "left" | "right"): ViewStyle => ({
    position: "absolute",
    top: 0,
    height: size,
    width: size / 2,
    left: side === "right" ? size / 2 : 0,
    overflow: "hidden",
  })

  const disc = (fill: string): ViewStyle => ({
    position: "absolute",
    top: 0,
    left: -size / 2,
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: stroke,
    borderColor: fill,
  })

  /** A full ring box (rotated as a unit) clipped to its own right semicircle. */
  const arc = (offsetX: number, rotate: number, fill: string): ReactNode => (
    <View
      style={[box, offsetX ? { left: offsetX } : null, rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null]}
    >
      <View style={window("right")}>
        <View style={disc(fill)} />
      </View>
    </View>
  )

  const display = label === undefined ? clamped : label

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      accessibilityLabel={`${clamped}/100`}
      // react-native-web does not derive these from accessibilityValue, so a
      // screen reader on web would otherwise get the role with no numeric value.
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Track */}
      <View
        style={[box, { borderRadius: size / 2, borderWidth: stroke, borderColor: tokens.c.border }]}
      />
      {/* Progress arc */}
      {sweep <= 180 ? (
        <View style={window("right")}>{arc(-size / 2, sweep - 180, color)}</View>
      ) : (
        <>
          <View style={window("right")}>{arc(-size / 2, 0, color)}</View>
          <View style={window("left")}>{arc(0, sweep - 180, color)}</View>
        </>
      )}
      {/* Centre label */}
      <View
        style={[
          box,
          { alignItems: "center", justifyContent: "center", paddingHorizontal: stroke },
        ]}
      >
        <Text
          style={{
            fontSize: size / 4,
            fontWeight: "700",
            color: tokens.c.textStrong,
            textAlign: "center",
          }}
        >
          {display}
        </Text>
        {caption ? (
          <Text
            style={{
              fontSize: 12,
              color: tokens.c.muted,
              textAlign: "center",
            }}
          >
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
