import { redirect } from "next/navigation";
import { createProject } from "@/app/p/[id]/actions";
import { getCurrentMember } from "@/lib/workspace";

// "Start your project" on the website: a signed-in Admin or Producer lands straight in a new
// project's brief chat; anyone else goes to their projects; a visitor logs in first.
export default async function StartPage() {
  const me = await getCurrentMember();
  if (!me) redirect("/login?next=/start");
  if (!["admin", "producer"].includes(me.role)) redirect("/projects");
  await createProject();
}
