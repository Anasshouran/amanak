import { CategoryCard } from "./CategoryCard"

export type CategoryCardsProps = {
  items: { id: string; title: string; attempted: number; total: number }[]
  onStart: (id: string) => void
}

export function CategoryCards({ items, onStart }: CategoryCardsProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "var(--space-3)",
      }}
    >
      {items.map((it) => (
        <CategoryCard
          key={it.id}
          id={it.id}
          title={it.title}
          attempted={it.attempted}
          total={it.total}
          onStart={onStart}
        />
      ))}
    </div>
  )
}
