-- ============================================================
-- Cloisonner la LECTURE des photos d'inspection par garage.
--
-- 2026-09-20 a créé le seau `inspection-photos` avec un SELECT ouvert :
--     for select using (bucket_id = 'inspection-photos')
-- documenté comme « compromis MVP assumé », au motif que ce sont des
-- photos d'état de véhicule et non des données financières.
--
-- Le raisonnement portait sur la mauvaise chose. Il justifie qu'une photo
-- soit LISIBLE par URL — ce que le drapeau `public` du seau accorde déjà,
-- par /object/public/…, un chemin qui ne consulte pas ces politiques. Le
-- lien envoyé au client fonctionne donc sans cette politique.
--
-- Ce que la politique ouverte ajoutait en réalité, c'est le droit pour
-- tout employé authentifié de LISTER le dossier d'un autre garage. La
-- protection annoncée était « le chemin est un UUID indevinable » ; qui
-- peut lister n'a plus rien à deviner. Une sonde du 9 septembre 2026 l'a
-- confirmé : depuis le garage A, `list` sur le préfixe du garage B
-- renvoyait ses objets, ceux-ci devenant ensuite lisibles un à un.
--
-- On aligne donc la lecture sur le patron déjà appliqué à
-- `vehicules-stock` (2026-09-11) et `factures-pieces` — les seuls seaux
-- qui résistaient à la sonde.
--
-- Ce que ça ne change pas : l'INSERT et le DELETE étaient déjà cloisonnés
-- par garage_actuel(), et le seau reste public en lecture par URL — ce
-- compromis-là, lui, est réel et toujours assumé.
-- ============================================================

drop policy if exists "inspection_photos_storage_select" on storage.objects;

create policy "inspection_photos_storage_select" on storage.objects
  for select using (
    bucket_id = 'inspection-photos'
    and (storage.foldername(name))[1] = garage_actuel()::text
  );
