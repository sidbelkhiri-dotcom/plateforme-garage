export default function Champ({
  label,
  erreur,
  required,
  className = "",
  ...props
}: {
  label: string;
  erreur?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold text-mf-text-3 text-[11px] uppercase tracking-[0.08em]">
        {label}
        {required && " *"}
      </span>
      <input
        required={required}
        aria-invalid={!!erreur}
        className={`bg-mf-surface-3 border rounded-mf-sm px-3 py-2 text-sm text-mf-text min-h-[44px] placeholder:text-mf-text-3 transition-colors duration-150 focus:outline-none focus:ring-[3px] ${
          erreur
            ? "border-mf-red focus:ring-mf-red-soft"
            : "border-mf-border-strong focus:border-mf-blue focus:ring-mf-blue-soft"
        } ${className}`}
        {...props}
      />
      {erreur && (
        <span role="alert" className="text-xs text-mf-red">
          {erreur}
        </span>
      )}
    </label>
  );
}
