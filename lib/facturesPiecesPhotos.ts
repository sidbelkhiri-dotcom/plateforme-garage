// Bucket Supabase Storage dédié aux photos de factures fournisseur sur
// les pièces d'un bon de travail — voir migration
// 2026-08-21_photo_facture_piece.sql. Privé (documents d'achat internes,
// utiles pour une réclamation de garantie) : URL signée à la demande,
// contrairement à vehicules-stock qui est public.

export const BUCKET_FACTURES_PIECES = "factures-pieces";

export async function urlSigneePhotoFacturePiece(supabase: any, chemin: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET_FACTURES_PIECES).createSignedUrl(chemin, 3600);
  return data?.signedUrl ?? null;
}
