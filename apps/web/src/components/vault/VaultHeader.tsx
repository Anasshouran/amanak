import type { ReactNode } from "react";
import { Button } from "../../design/components";
import { useT } from "../../design/i18n";

export type VaultHeaderProps = {
  title: string;
  subtitle: string;
  children?: ReactNode;
  className?: string;
};

export function VaultHeader({ title, subtitle, children, className }: VaultHeaderProps) {
  const t = useT();
  return (
    <div className={`amk-page-head vault-header ${className ?? ""}`}>
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
