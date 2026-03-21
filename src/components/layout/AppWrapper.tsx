"use client";

import { useAuth, AuthProvider } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { PlatformProvider } from "@/context/PlatformContext";
import { ActionPlanProvider } from "@/context/ActionPlanContext";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // FIX #8: Redirigir al dashboard si ya está autenticado y navega al login
    if (user && pathname === "/login") {
      router.replace("/");
      return;
    }

    // Redirigir al login si no está autenticado y no está en /login
    if (!user && pathname !== "/login") {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background-dark gap-4">
        <div className="size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="text-slate-500 font-black tracking-widest text-[10px] uppercase">
          Cargando Sistema...
        </p>
      </div>
    );
  }

  // No renderizar nada mientras se hace la redirección
  if (!user && pathname !== "/login") return null;

  return <>{children}</>;
}

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <AuthProvider>
      <AuthGuard>
        <PlatformProvider>
          <ActionPlanProvider>
            <div className="flex h-screen overflow-hidden">
              {!isLoginPage && <Sidebar />}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {!isLoginPage && <Header />}
                <main
                  className={`flex-1 overflow-y-auto ${
                    !isLoginPage ? "p-4 md:p-8" : ""
                  }`}
                >
                  {children}
                </main>
              </div>
            </div>
          </ActionPlanProvider>
        </PlatformProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
