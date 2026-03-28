import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center space-y-6 px-4">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold text-white">
            OmniGestion 2026
          </h1>
          <p className="text-xl text-slate-400">
            Plateforme de gestion commerciale hybride Algérie / France
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Link
            href="/auth/login"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Se connecter
          </Link>
          <Link
            href="/auth/register"
            className="px-8 py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-lg font-medium transition-colors"
          >
            Créer un compte
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-12 text-center">
          {[
            { label: "Facturation", icon: "📄" },
            { label: "Devis", icon: "📝" },
            { label: "Clients", icon: "👥" },
            { label: "Rapports", icon: "📊" },
          ].map((feature) => (
            <div key={feature.label} className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="text-3xl mb-2">{feature.icon}</div>
              <div className="text-slate-300 text-sm font-medium">{feature.label}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
