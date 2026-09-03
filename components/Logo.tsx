// Texte générique en attendant le nom définitif de la plateforme — le
// logo MECAFORCE (marque d'un seul garage) n'a pas sa place ici, cette
// app sert plusieurs garages. Remplacer par le vrai logo une fois le
// nom choisi.
export default function Logo({ height = 20, className = "" }: { height?: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center font-display font-black uppercase tracking-wide text-mf-text ${className}`}
      style={{ height, fontSize: height * 0.75, lineHeight: `${height}px` }}
    >
      Plateforme Garage
    </span>
  );
}
