import { Button } from "@/components/ui/button";
import { Plus, Receipt } from "lucide-react";

export default function DepensesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dépenses</h1>
          <p className="text-slate-500">Suivi des dépenses</p>
        </div>
        <Button disabled><Plus className="h-4 w-4 mr-2" />Nouvelle dépense</Button>
      </div>
      <div className="bg-white rounded-xl border shadow-sm p-12 text-center text-slate-500">
        <Receipt className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <p className="font-medium">Module dépenses</p>
        <p className="text-sm">Bientôt disponible</p>
      </div>
    </div>
  );
}
