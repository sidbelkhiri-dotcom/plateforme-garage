// Bucket Supabase Storage pour les photos d'inspection — voir migration
// 2026-09-20_inspection_multi_tenant.sql. Public en lecture (photos
// d'état de véhicule, aucune donnée financière) : getPublicUrl() suffit,
// pas besoin d'URL signée comme pour factures-pieces.

export const BUCKET_INSPECTION_PHOTOS = "inspection-photos";

export function urlPubliquePhotoInspection(supabase: any, chemin: string): string {
  return supabase.storage.from(BUCKET_INSPECTION_PHOTOS).getPublicUrl(chemin).data.publicUrl;
}
