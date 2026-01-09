import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { validateSession } from "$lib/server/auth/session";

export const load: PageServerLoad = async ({ cookies }) => {
  const user = await validateSession(cookies);

  if (!user) {
    redirect(302, "/login");
  }

  return { user };
};
