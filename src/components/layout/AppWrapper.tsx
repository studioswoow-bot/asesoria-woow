"use client";

import { useAuth, AuthProvider } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { PlatformProvider } from "@/context/PlatformContext";
import { ActionPlanProvider } from "@/context/ActionPlanContext";
import { ThemeProvider } from "@/context/ThemeContext";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Redirigir al login si no está autenticado y no está en /login
    if (!user && pathname !== "/login") {
      router.replace("/login");
      return;
    }

    // FIX #8: Redirigir al dashboard si ya está autenticado y navega al login
    if (user && pathname === "/login") {
      const role = (user as any).role || profile?.role;
      if (role === 'model' && profile?.modelId) {
        router.replace(`/models/profile?id=${profile.modelId}`);
      } else {
        router.replace("/");
      }
      return;
    }

    // REDIRECCIÓN ESPECITICA PARA MODELOS:
    // Si una modelo intenta entrar al dashboard general o páginas administrativas, mandarla a su perfil
    if (profile?.role === 'model' && profile.modelId) {
      const allowedPaths = ['/models/profile', '/models/analytics', '/action-plans', '/login'];
      const isAllowed = allowedPaths.some(path => pathname.startsWith(path));
      
      if (!isAllowed || pathname === '/') {
        router.replace(`/models/profile?id=${profile.modelId}`);
      }
    }
  }, [user, profile, loading, pathname, router]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background-page gap-4 transition-colors duration-300">
        <div className="size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="text-text-muted font-black tracking-widest text-[10px] uppercase">
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
      <ThemeProvider>
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
                    {!isLoginPage && (
                      <footer className="mt-12 pb-8 text-center border-t border-text-main/5 pt-8">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted/40">
                          Propiedad WooW Estudios 2026. Marca registrada
                        </p>
                      </footer>
                    )}
                  </main>
                </div>
              </div>
            </ActionPlanProvider>
          </PlatformProvider>
        </AuthGuard>
      </ThemeProvider>
    </AuthProvider>
  );
}
