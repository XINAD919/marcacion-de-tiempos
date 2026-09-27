import type { Metadata } from "next";
import { Importador } from "./importador";

export const metadata: Metadata = { title: "Importar desde Excel" };

export default function ImportarPage() {
  return <Importador />;
}
