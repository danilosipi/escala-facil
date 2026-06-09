export function ComplianceDisclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-slate-500 ${className}`}>
      Os alertas trabalhistas são apoio à conformidade conforme parâmetros configurados — não
      substituem assessoria jurídica nem garantem ausência de riscos.
    </p>
  );
}
