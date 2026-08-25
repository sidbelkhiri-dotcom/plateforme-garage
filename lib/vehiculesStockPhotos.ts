// Bucket Supabase Storage dédié aux photos de véhicules en stock — voir
// migration 2026-08-17_photos_vehicules_stock.sql. Public en lecture
// (aucune donnée sensible), écriture réservée admin/reception. Les
// chemins (pas les URLs complètes) sont stockés dans
// vehicules_stock.photos, reconstruits ici à l'affichage.

export const BUCKET_VEHICULES_STOCK = "vehicules-stock";

export function urlPhotoVehiculeStock(supabase: any, chemin: string): string {
  return supabase.storage.from(BUCKET_VEHICULES_STOCK).getPublicUrl(chemin).data.publicUrl;
}
