import type { ElementType, ReactNode, CSSProperties } from "react"
import { cx } from "../utils"

export type CardProps = {
  children: ReactNode
  padded?: boolean
  elevated?: boolean
  as?: ElementType
  className?: string
  style?: CSSProperties
  title?: ReactNode
  action?: ReactNode
}

export function Card({ children, padded, elevated, as, className, style, title, action }: CardProps) {
  const Tag = (as ?? "section") as ElementType
  return (
    <Tag
      className={cx("amk-card", padded && "amk-card--padded", elevated && "amk-card--elevated", className)}
      style={style}
    >
      {(title || action) && (
        <div className="amk-card__head">
          {title && <h3 className="amk-card__title">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </Tag>
  )
}
