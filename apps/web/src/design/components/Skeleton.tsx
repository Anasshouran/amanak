import { cx } from "../utils"

export type SkeletonProps = {
  width?: number | string
  height?: number | string
  radius?: number | string
  className?: string
}

export function Skeleton({ width = "100%", height = 14, radius, className }: SkeletonProps) {
  return (
    <span
      className={cx("amk-skeleton", className)}
      style={{ display: "block", width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}
