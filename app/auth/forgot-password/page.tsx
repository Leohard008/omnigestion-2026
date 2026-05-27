"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Email invalide"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      // Always show success per anti-enumeration spec
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Mot de passe oublié</CardTitle>
          <CardDescription>
            {submitted
              ? "Vérifiez votre boîte mail pour le lien de réinitialisation."
              : "Entrez votre email pour recevoir un lien de réinitialisation."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="p-3 text-sm text-green-700 bg-green-50 rounded-md border border-green-200">
              Si un compte existe pour cette adresse, un email contenant un lien de réinitialisation
              vient de vous être envoyé. Le lien est valide pendant 1 heure.
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Envoi..." : "Envoyer le lien"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground text-center w-full">
            <Link href="/auth/login" className="text-primary hover:underline font-medium">
              ← Retour à la connexion
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
