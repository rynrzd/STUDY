// =============================================================================
// « Télécharger mes données » (src/app/app/reglages/export/route.ts).
//
// La route lit sous la session de la personne. Ce test rejoue, en SQL et sous
// le même rôle, chacune de ses lectures : mêmes tables, mêmes colonnes, même
// filtre. Il prouve trois choses :
//   1. chaque lecture est permise à un élève (aucune colonne inexistante,
//      aucune table fermée) ;
//   2. avec son propre identifiant, il ne reçoit que ses lignes ;
//   3. avec l'identifiant d'un camarade, les politiques de ligne ne lui rendent
//      rien de ce qui est privé — le filtre de la route n'est donc pas la
//      seule barrière.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, baseDeTest, lirePour } from "./harness.mjs";

// [section, requête paramétrée par l'identifiant visé ($1), colonne propriétaire ou null]
const LECTURES = [
  ["profil", "select id, first_name, last_name, professional_email, created_at from study.profiles where id = $1", "id"],
  ["adhesions", "select profile_id, roles, local_login, account_state, state, activated_at, suspended_at, ended_at, created_at from study.organization_memberships where profile_id = $1", "profile_id"],
  ["inscriptions", "select e.profile_id, e.is_principal, e.starts_on, e.ends_on, c.label from study.class_enrollments e left join study.classes c on c.id = e.class_id where e.profile_id = $1", "profile_id"],
  ["remises", "select profile_id, id, assignment_id, state, draft_body, draft_updated_at, submitted_count, created_at from study.submissions where profile_id = $1", "profile_id"],
  ["notes_personnelles", "select owner_id, lesson_id, chapter_id, body, created_at, updated_at from study.personal_notes where owner_id = $1", "owner_id"],
  ["messages_ecrits", "select author_id, workgroup_id, teaching_space_id, body, edited_at, hidden_at, created_at from study.messages where author_id = $1", "author_id"],
  ["reponses_entraide", "select auteur_id, fil_id, texte, utile, masque_le, created_at from study.reponses_entraide where auteur_id = $1", "auteur_id"],
  ["tentatives", "select profile_id, exercice_version_id, reponse, correct, aide_utilisee, temps_actif_s, jour, created_at from study.tentatives where profile_id = $1", "profile_id"],
  ["fiches", "select owner_id, titre, format, objectif, longueur, etat, sections, cartes, exercices, limites, created_at, updated_at from study.fiches_revision where owner_id = $1", "owner_id"],
  ["projets", "select owner_id, id, titre, description, visibilite, archived_at, created_at, updated_at from study.projets where owner_id = $1", "owner_id"],
  ["notes_de_projet", "select auteur_id, projet_id, kind, titre, corps, url, created_at from study.projet_notes where auteur_id = $1", "auteur_id"],
  ["taches_de_projet", "select created_by, projet_id, titre, statut, echeance, created_at, updated_at from study.projet_taches where created_by = $1", "created_by"],
  ["orientation", "select owner_id, kind, intitule, organisation, statut, contact_pro, echeance, notes, created_at, updated_at from study.orientation_pistes where owner_id = $1", "owner_id"],
  ["agenda_personnel", "select owner_id, kind, titre, debut, fin, lien, created_at from study.agenda_evenements where owner_id = $1", "owner_id"],
  ["reponses_ateliers", "select author_id, atelier_id, annotations, contestation, created_at, updated_at from study.ateliers_reponses where author_id = $1", "author_id"],
  ["reponses_consultations", "select author_id, consultation_id, ce_qui_fonctionne, difficulte, proposition, categorie, created_at from study.consultation_reponses where author_id = $1", "author_id"],
  ["demandes", "select author_id, recipient_id, id, subject, state, created_at, closed_at from study.demandes_adulte where author_id = $1 or recipient_id = $1", null],
  ["versions_remises", "select s.profile_id, v.id, v.submission_id, v.version_number, v.body, v.submitted_at, v.late from study.submission_versions v join study.submissions s on s.id = v.submission_id where s.profile_id = $1", "profile_id"],
  ["appreciations", "select s.profile_id, f.submission_version_id, f.general_comment, f.rubric, f.requires_rework, f.rework_due_at, f.published_at from study.feedback f join study.submission_versions v on v.id = f.submission_version_id join study.submissions s on s.id = v.submission_id where s.profile_id = $1 and f.published_at is not null", "profile_id"],
  ["messages_des_demandes", "select d.author_id, d.recipient_id, m.demande_id, m.author_id as auteur_message, m.body, m.created_at from study.demandes_adulte_messages m join study.demandes_adulte d on d.id = m.demande_id where d.author_id = $1 or d.recipient_id = $1", null],
];

// Sections strictement privées : un camarade ne doit rien en lire.
const PRIVEES = ["notes_personnelles", "tentatives", "fiches", "orientation", "agenda_personnel", "remises", "demandes"];

test("EXPORT-01 — chaque lecture de l'export est permise à l'élève et ne rend que ses lignes", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const moi = ACTEURS.eleveA1Rayan;

  // Quelques données personnelles, créées par les chemins du produit quand ils existent.
  await lirePour(db, moi, "select study.projet_creer('Mon projet', 'Pour moi', 'prive', null)");

  for (const [nom, sql, proprietaire] of LECTURES) {
    const lignes = await lirePour(db, moi, sql, [moi]);
    if (proprietaire) {
      for (const l of lignes) assert.equal(l[proprietaire], moi, `${nom} : une ligne d'une autre personne`);
    } else {
      for (const l of lignes) assert.ok(l.author_id === moi || l.recipient_id === moi, `${nom} : demande étrangère`);
    }
  }
  const carnet = await lirePour(db, moi, "select * from study.carnet_lire(true)");
  assert.ok(Array.isArray(carnet), "le carnet se lit par sa fonction");
  const projets = await lirePour(db, moi, LECTURES.find(([n]) => n === "projets")[1], [moi]);
  assert.equal(projets.length, 1, "le projet créé figure dans l'export");
  const profil = await lirePour(db, moi, LECTURES[0][1], [moi]);
  assert.equal(profil.length, 1, "le profil de la personne est lisible");
});

test("EXPORT-02 — la même lecture visant un camarade ne rend rien de privé (RLS, pas seulement le filtre)", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const camarade = ACTEURS.eleveA1Lina;
  await lirePour(db, camarade, "select study.projet_creer('Projet de Lina', 'privé', 'prive', null)");

  for (const [nom, sql] of LECTURES.filter(([n]) => PRIVEES.includes(n) || n === "projets")) {
    const lignes = await lirePour(db, ACTEURS.eleveA1Rayan, sql, [camarade]);
    assert.equal(lignes.length, 0, `${nom} d'un camarade lisible par un autre élève`);
  }
});
