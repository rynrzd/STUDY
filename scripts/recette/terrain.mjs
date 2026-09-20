// =============================================================================
// Le terrain de recette — un établissement complet, jetable.
//
// Les sections §1 à §8 du cahier ont toutes besoin de la même chose : un
// lycée, deux classes, un professeur, deux élèves dans la même classe et un
// troisième dans une classe témoin. Le construire une fois, ici, évite que
// chaque scénario invente le sien — et que les différences entre ces terrains
// expliquent des échecs qu'on attribuerait au produit.
//
// La classe témoin n'est pas décorative : c'est elle qui prouve qu'une
// publication ne fuit pas. Un test d'isolation sans témoin ne prouve rien. Le
// professeur enseigne dans les **deux** classes, sans quoi on ne saurait pas
// distinguer « pas publié ici » de « pas enseignant ici ».
//
// Tout passe par les fonctions de `src/lib`, celles que l'application appelle,
// et non par des insertions directes : un terrain bâti autrement que le
// produit ne le bâtit ne prouverait rien sur le produit.
//
// Aucun mot de passe n'est affiché ni écrit. Ils sont rendus à l'appelant,
// vivent en mémoire, et meurent avec le processus.
// =============================================================================

import { randomBytes } from "node:crypto";

/** Un identifiant lisible, unique, et reconnaissable comme venant d'une recette. */
export function marqueurUnique() {
  const jour = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${jour}${randomBytes(3).toString("hex")}`;
}

/**
 * Construit l'établissement de recette et ses comptes.
 *
 * `lib` porte les fonctions de `src/lib/etablissement.ts`, injectées par
 * l'appelant : ce fichier ne peut pas les importer lui-même, elles exigent la
 * condition `react-server`.
 */
export async function preparerTerrain({ service, exploitant, marqueur, lib }) {
  const suffixe = marqueur.slice(-6);
  const code = `RECETTE-${suffixe.toUpperCase()}`;
  const domaine = process.env.STUDENT_ALIAS_DOMAIN ?? "exemple.invalid";

  /* --- L'établissement ----------------------------------------------------- */

  const { data: organisation, error: erreurOrg } = await service.rpc("admin_creer_etablissement", {
    p_acteur: exploitant,
    p_nom: `Lycee de recette ${suffixe}`,
    p_code: code,
    p_slug: `lycee-recette-${suffixe}`,
    p_type: "public",
    p_commune: "Roubaix",
  });
  if (erreurOrg !== null) throw new Error(`etablissement : ${erreurOrg.message}`);

  await service.rpc("admin_changer_etat_etablissement", {
    p_acteur: exploitant,
    p_organisation: organisation,
    p_etat: "actif",
    p_motif: "Ouverture pour la recette automatisee",
  });

  /* --- L'administrateur ---------------------------------------------------- */

  const courrielAdmin = `admin.${suffixe}@exemple.invalid`;
  const motDePasseAdmin = `Temporaire-${randomBytes(9).toString("hex")}`;

  const creationAdmin = await service.auth.admin.createUser({
    email: courrielAdmin,
    password: motDePasseAdmin,
    email_confirm: true,
  });
  if (creationAdmin.error !== null) throw new Error(`compte admin : ${creationAdmin.error.message}`);
  const administrateur = creationAdmin.data.user.id;

  const loginAdmin = `a.recette${suffixe}`;
  const { error: erreurAdmin } = await service.rpc("admin_creer_administrateur", {
    p_acteur: exploitant,
    p_organisation: organisation,
    p_profile: administrateur,
    p_prenom: "Agathe",
    p_nom: "Recette",
    p_email: courrielAdmin,
    p_identifiant: loginAdmin,
    p_alias: courrielAdmin,
  });
  if (erreurAdmin !== null) throw new Error(`administrateur : ${erreurAdmin.message}`);

  /* --- L'année, les classes, la matière ------------------------------------ */

  const annee = await lib.assurerAnnee(administrateur);
  if (annee === null) throw new Error("annee scolaire non preparee");

  const classes = {};
  for (const [cle, libelle] of [
    ["cible", "Seconde 4"],
    ["temoin", "Seconde 7"],
  ]) {
    const id = await lib.creerClasse(administrateur, annee, libelle);
    if (id === null) throw new Error(`classe ${libelle} non creee`);
    classes[cle] = { id, libelle };
  }

  const matiere = await lib.creerMatiere(administrateur, "Mathematiques");
  if (matiere === null) throw new Error("matiere non creee");

  /* --- Le professeur et les élèves ----------------------------------------- */

  const comptes = {};

  const professeur = await lib.creerCompte({
    acteur: administrateur,
    prenom: "Pierre",
    nom: "Martin",
    login: `p.martin${suffixe}`,
    role: "professeur",
    classe: null,
    classeLabel: null,
    email: `prof.${suffixe}@exemple.invalid`,
    domaineAlias: domaine,
  });
  if (professeur.etat !== "cree") {
    throw new Error(`professeur : ${professeur.raison ?? professeur.etat}`);
  }
  comptes.professeur = { ...professeur.acces, id: await profilDe(service, organisation, professeur.acces.login) };

  for (const [cle, prenom, nom, classe] of [
    ["eleveA", "Amelie", "Durand", "cible"],
    ["eleveB", "Bruno", "Lefevre", "cible"],
    ["eleveTemoin", "Chloe", "Petit", "temoin"],
  ]) {
    const eleve = await lib.creerCompte({
      acteur: administrateur,
      prenom,
      nom,
      login: `${prenom.toLowerCase()}.${nom.toLowerCase()}${suffixe}`,
      role: "eleve",
      classe: classes[classe].id,
      classeLabel: classes[classe].libelle,
      email: null,
      domaineAlias: domaine,
    });
    if (eleve.etat !== "cree") throw new Error(`${cle} : ${eleve.raison ?? eleve.etat}`);

    comptes[cle] = {
      ...eleve.acces,
      classe: classes[classe].libelle,
      classeId: classes[classe].id,
      id: await profilDe(service, organisation, eleve.acces.login),
    };
  }

  /* --- Les cours : le professeur enseigne dans les deux classes ------------ */

  const cours = {};
  for (const cle of ["cible", "temoin"]) {
    const fait = await lib.affecterProfesseur({
      acteur: administrateur,
      professeur: comptes.professeur.id,
      classe: classes[cle].id,
      matiere,
      annee,
    });
    if (!fait) throw new Error(`affectation ${cle} refusee`);

    const { data, error } = await service
      .from("teaching_spaces")
      .select("id")
      .eq("class_id", classes[cle].id)
      .eq("subject_id", matiere)
      .maybeSingle();
    if (error !== null || data === null) throw new Error(`cours ${cle} introuvable`);
    cours[cle] = data.id;
  }

  return {
    code,
    organisation,
    annee,
    classes,
    matiere,
    cours,
    administrateur: {
      id: administrateur,
      login: loginAdmin,
      motDePasse: motDePasseAdmin,
      activationRequise: true,
    },
    comptes,
    marqueur,
    suffixe,
  };
}

/** L'identifiant de profil derrière un identifiant local. */
async function profilDe(service, organisation, login) {
  const { data, error } = await service
    .from("organization_memberships")
    .select("profile_id")
    .eq("organization_id", organisation)
    .eq("local_login", login)
    .single();
  if (error !== null) throw new Error(`profil de ${login} : ${error.message}`);
  return data.profile_id;
}
