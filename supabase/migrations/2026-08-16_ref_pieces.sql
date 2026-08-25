-- ============================================================
-- Migration : 2026-08-16 — catalogue générique de pièces automobiles
-- Alimente le menu déroulant du formulaire d'inventaire (/inventaire).
-- Contrairement à ref_vehicule_ymm (moissonné depuis vPIC), il n'existe
-- pas d'API publique gratuite équivalente pour un catalogue de pièces —
-- liste organisée par catégorie, écrite à la main pour un atelier
-- mécanique généraliste. Même patron que ref_vehicule_ymm : table de
-- référence en lecture seule + vue des catégories distinctes.
-- ============================================================

create table ref_pieces (
  id bigint generated always as identity primary key,
  categorie text not null,
  nom text not null,
  unique (categorie, nom)
);
create index idx_ref_pieces_categorie on ref_pieces (categorie);

alter table ref_pieces enable row level security;

-- Lecture seule pour l'application, réservée à l'authentifié — /inventaire
-- est derrière la connexion (contrairement à /accueil), donc pas besoin
-- d'ouvrir à anon comme ref_vehicule_ymm. Aucune policy d'écriture : le
-- chargement se fait par cette migration, jamais depuis le client.
create policy "ref_pieces_select_authenticated" on ref_pieces
  for select using (auth.role() = 'authenticated');

-- Catégories distinctes, pour le premier menu déroulant.
create view ref_categories_pieces
  with (security_invoker = true) as
select distinct categorie from ref_pieces order by categorie;

insert into ref_pieces (categorie, nom) values
  ('Freins', 'Plaquettes de frein avant'),
  ('Freins', 'Plaquettes de frein arrière'),
  ('Freins', 'Disques de frein avant'),
  ('Freins', 'Disques de frein arrière'),
  ('Freins', 'Tambours de frein arrière'),
  ('Freins', 'Mâchoires de frein arrière'),
  ('Freins', 'Étrier de frein avant'),
  ('Freins', 'Étrier de frein arrière'),
  ('Freins', 'Cylindre de roue'),
  ('Freins', 'Maître-cylindre de frein'),
  ('Freins', 'Flexible de frein'),
  ('Freins', 'Câble de frein à main'),
  ('Freins', 'Capteur ABS'),
  ('Freins', 'Liquide de frein DOT 3'),
  ('Freins', 'Liquide de frein DOT 4'),

  ('Moteur', 'Bougies d''allumage'),
  ('Moteur', 'Fils de bougies'),
  ('Moteur', 'Bobine d''allumage'),
  ('Moteur', 'Courroie de distribution'),
  ('Moteur', 'Chaîne de distribution'),
  ('Moteur', 'Tendeur de courroie de distribution'),
  ('Moteur', 'Joint de culasse'),
  ('Moteur', 'Pompe à eau'),
  ('Moteur', 'Thermostat'),
  ('Moteur', 'Capteur d''oxygène (sonde lambda)'),
  ('Moteur', 'Capteur de position d''arbre à cames'),
  ('Moteur', 'Capteur de position de vilebrequin'),
  ('Moteur', 'Injecteur de carburant'),
  ('Moteur', 'Pompe à carburant'),
  ('Moteur', 'Support moteur'),
  ('Moteur', 'Soupape EGR'),
  ('Moteur', 'Turbocompresseur'),
  ('Moteur', 'Joint de cache-culbuteurs'),
  ('Moteur', 'Bouchon de vidange d''huile'),

  ('Filtres', 'Filtre à huile'),
  ('Filtres', 'Filtre à air moteur'),
  ('Filtres', 'Filtre à air habitacle (pollen)'),
  ('Filtres', 'Filtre à carburant'),
  ('Filtres', 'Filtre à transmission'),

  ('Refroidissement', 'Radiateur'),
  ('Refroidissement', 'Ventilateur de radiateur'),
  ('Refroidissement', 'Bouchon de radiateur'),
  ('Refroidissement', 'Durite de radiateur supérieure'),
  ('Refroidissement', 'Durite de radiateur inférieure'),
  ('Refroidissement', 'Liquide de refroidissement (antigel)'),
  ('Refroidissement', 'Réservoir de liquide de refroidissement'),

  ('Suspension et direction', 'Amortisseur avant'),
  ('Suspension et direction', 'Amortisseur arrière'),
  ('Suspension et direction', 'Ressort hélicoïdal'),
  ('Suspension et direction', 'Rotule de suspension'),
  ('Suspension et direction', 'Barre stabilisatrice'),
  ('Suspension et direction', 'Biellette de barre stabilisatrice'),
  ('Suspension et direction', 'Bras de suspension inférieur'),
  ('Suspension et direction', 'Bras de suspension supérieur'),
  ('Suspension et direction', 'Roulement de roue avant'),
  ('Suspension et direction', 'Roulement de roue arrière'),
  ('Suspension et direction', 'Crémaillère de direction'),
  ('Suspension et direction', 'Pompe de direction assistée'),
  ('Suspension et direction', 'Embout de biellette de direction'),
  ('Suspension et direction', 'Coussinet de suspension'),

  ('Transmission', 'Liquide de transmission automatique'),
  ('Transmission', 'Embrayage (kit complet)'),
  ('Transmission', 'Volant moteur'),
  ('Transmission', 'Cylindre récepteur d''embrayage'),
  ('Transmission', 'Cylindre émetteur d''embrayage'),
  ('Transmission', 'Joint homocinétique (CV)'),
  ('Transmission', 'Cardan'),
  ('Transmission', 'Coussinet de support de transmission'),

  ('Électrique et éclairage', 'Batterie'),
  ('Électrique et éclairage', 'Alternateur'),
  ('Électrique et éclairage', 'Démarreur'),
  ('Électrique et éclairage', 'Ampoule de phare'),
  ('Électrique et éclairage', 'Ampoule de feu arrière'),
  ('Électrique et éclairage', 'Phare avant (assemblage)'),
  ('Électrique et éclairage', 'Feu arrière (assemblage)'),
  ('Électrique et éclairage', 'Fusible'),
  ('Électrique et éclairage', 'Relais'),
  ('Électrique et éclairage', 'Capteur de vitesse'),
  ('Électrique et éclairage', 'Module de contrôle (ECU)'),
  ('Électrique et éclairage', 'Câble de batterie'),

  ('Échappement', 'Silencieux'),
  ('Échappement', 'Catalyseur'),
  ('Échappement', 'Tuyau d''échappement'),
  ('Échappement', 'Collecteur d''échappement'),
  ('Échappement', 'Résonateur'),
  ('Échappement', 'Joint d''échappement'),
  ('Échappement', 'Support d''échappement'),

  ('Climatisation', 'Compresseur de climatisation'),
  ('Climatisation', 'Condenseur de climatisation'),
  ('Climatisation', 'Évaporateur'),
  ('Climatisation', 'Filtre déshydrateur (accumulateur)'),
  ('Climatisation', 'Détendeur (valve d''expansion)'),
  ('Climatisation', 'Réfrigérant R-134a'),
  ('Climatisation', 'Réfrigérant R-1234yf'),

  ('Pneus et roues', 'Pneu (unité)'),
  ('Pneus et roues', 'Valve de pneu (TPMS)'),
  ('Pneus et roues', 'Capteur de pression des pneus'),
  ('Pneus et roues', 'Poids d''équilibrage de roue'),
  ('Pneus et roues', 'Enjoliveur de roue'),
  ('Pneus et roues', 'Écrou de roue'),

  ('Carrosserie et accessoires', 'Essuie-glace avant'),
  ('Carrosserie et accessoires', 'Essuie-glace arrière'),
  ('Carrosserie et accessoires', 'Moteur d''essuie-glace'),
  ('Carrosserie et accessoires', 'Rétroviseur extérieur'),
  ('Carrosserie et accessoires', 'Poignée de porte'),
  ('Carrosserie et accessoires', 'Pare-brise'),
  ('Carrosserie et accessoires', 'Ampoule de tableau de bord'),

  ('Fluides et lubrifiants', 'Huile moteur 0W-20'),
  ('Fluides et lubrifiants', 'Huile moteur 5W-20'),
  ('Fluides et lubrifiants', 'Huile moteur 5W-30'),
  ('Fluides et lubrifiants', 'Huile moteur 10W-30'),
  ('Fluides et lubrifiants', 'Liquide de direction assistée'),
  ('Fluides et lubrifiants', 'Graisse pour roulements'),
  ('Fluides et lubrifiants', 'Nettoyant pour injecteurs'),

  ('Courroies', 'Courroie serpentine (accessoires)'),
  ('Courroies', 'Tendeur de courroie serpentine'),
  ('Courroies', 'Poulie folle');
