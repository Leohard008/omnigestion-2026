import { Settings } from "lucide-react";

export default function ParametresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="text-slate-500">Configuration de votre organisation</p>
      </div>
      <div className="bg-white rounded-xl border shadow-sm p-12 text-center text-slate-500">
        <Settings className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <p className="font-medium">Paramètres</p>
        <p className="text-sm">Bientôt disponible</p>
      </div>
    </div>
  );
}
