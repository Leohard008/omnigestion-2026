import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  // Si l'utilisateur a déjà une organisation, rediriger vers le dashboard
  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
  });
  if (membership) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-sm border">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900">Bienvenue sur OmniGestion !</h2>
          <p className="mt-2 text-slate-600">
            Votre compte est créé. Connectez-vous pour accéder à votre organisation.
          </p>
        </div>
        <div className="text-center">
          <a
            href="/auth/login"
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Aller à la connexion
          </a>
        </div>
      </div>
    </div>
  );
}
