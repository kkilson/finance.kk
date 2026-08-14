import { redirect } from "next/navigation";
import { usuarioIdActual } from "@/lib/auth";

export default async function Home() {
  redirect((await usuarioIdActual()) ? "/dashboard" : "/login");
}
