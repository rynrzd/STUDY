/** Un signal par minute au plus, uniquement à la suite d'un geste réel visible. */
export function creerSignalementActivite(options: {
  visible: () => boolean;
  envoyer: () => Promise<{ status: number; ok: boolean }>;
  maintenant?: () => number;
}) {
  const maintenant = options.maintenant ?? Date.now;
  let prochain = 0;
  let enCours = false;
  let terminee = false;
  return async (e: { isTrusted: boolean }): Promise<void> => {
    if (!e.isTrusted || !options.visible() || terminee || enCours || maintenant() < prochain) return;
    enCours = true;
    prochain = maintenant() + 60_000;
    try {
      const r = await options.envoyer();
      if (r.status === 401) terminee = true;
      else if (!r.ok) prochain = maintenant() + 5_000;
    } catch {
      prochain = maintenant() + 5_000;
    } finally {
      enCours = false;
    }
  };
}
