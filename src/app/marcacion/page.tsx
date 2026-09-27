import type { Metadata } from "next";
import { Kiosko } from "./kiosko";

export const metadata: Metadata = { title: "Marcación" };

export default function MarcacionPage() {
  return <Kiosko />;
}
