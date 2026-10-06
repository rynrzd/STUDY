import { AccesIndisponible } from "@/components/study/ui";

/** 404 et refus se confondent : rien n'apprend qu'un objet existe ailleurs. */
export default function Introuvable() {
  return <AccesIndisponible />;
}
