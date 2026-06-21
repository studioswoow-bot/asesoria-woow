"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import LoadingScreen from "@/components/common/LoadingScreen";

interface SuspiciousTransfer {
  id: string;
  modelId: string;
  modelName: string;
  modelNickname: string;
  fileName: string;
  timestamp: number;
  date: string;
  time: string;
  amount: number;
  recipient: string;
  action: string;
}

export default function TransfersAuditPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [transfers, setTransfers] = useState<SuspiciousTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (!authLoading && user && profile && profile.role !== "admin") {
      setError("Acceso denegado: Solo los Administradores de Estudios WooW pueden acceder a la Auditoría de Fugas.");
      setLoading(false);
    }
  }, [user, profile, authLoading, router]);

  useEffect(() => {
    if (user && profile?.role === "admin") {
      fetchTransfers();
    }
  }, [user, profile]);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const qTransfers = query(
        collection(db, "suspicious_transfers"),
        orderBy("timestamp", "desc")
      );
      const querySnapshot = await getDocs(qTransfers);
      const list: SuspiciousTransfer[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          modelId: data.modelId || "",
          modelName: data.modelName || "",
          modelNickname: data.modelNickname || "",
          fileName: data.fileName || "",
          timestamp: data.timestamp || 0,
          date: data.date || "",
          time: data.time || "",
          amount: data.amount || 0,
          recipient: data.recipient || "",
          action: data.action || "",
        });
      });
      setTransfers(list);
    } catch (err: any) {
      console.error("Error fetching transfers:", err);
      setError("Error al cargar las transacciones sospechosas: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <LoadingScreen message="Verificando credenciales..." />;
  if (!user) return null;

  // Filtrado de transacciones
  const filteredTransfers = transfers.filter((t) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      t.modelName.toLowerCase().includes(searchLower) ||
      t.modelNickname.toLowerCase().includes(searchLower) ||
      t.recipient.toLowerCase().includes(searchLower) ||
      t.action.toLowerCase().includes(searchLower);

    const matchesStartDate = startDate ? t.date >= startDate : true;
    const matchesEndDate = endDate ? t.date <= endDate : true;

    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  // Métricas calculadas
  const totalTokensLeaked = filteredTransfers.reduce((acc, t) => acc + t.amount, 0);
  const totalIncidents = filteredTransfers.length;
  const involvedModels = new Set(filteredTransfers.map((t) => t.modelId)).size;
  const maxSingleLeak = filteredTransfers.reduce((max, t) => (t.amount > max ? t.amount : max), 0);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-display font-black text-text-main mb-2">Auditoría de Fuga de Fichas</h2>
          <p className="text-text-muted">
            Transacciones de salida hacia cuentas no registradas o externas detectadas en los históricos de Chaturbate.
          </p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl flex items-center gap-3 text-red-400 text-xs font-bold max-w-xs">
          <span className="material-symbols-outlined text-[18px]">security</span>
          Panel administrativo exclusivo. Acceso restringido.
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl flex items-center gap-4 text-red-300 text-sm">
          <span className="material-symbols-outlined text-red-500 text-2xl">warning</span>
          <div className="flex-1 font-bold">{error}</div>
        </div>
      )}

      {profile?.role === "admin" && (
        <>
          {/* Tarjetas de Métricas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-panel-dark border border-text-main/5 p-6 rounded-2xl shadow-xl flex items-center gap-4 group hover:border-red-500/20 transition-all duration-300">
              <div className="size-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl">trending_down</span>
              </div>
              <div>
                <p className="text-xs text-text-muted font-bold uppercase tracking-wider">Fichas Desviadas</p>
                <h3 className="text-2xl font-black text-text-main mt-1">
                  {totalTokensLeaked.toLocaleString()} TK
                </h3>
              </div>
            </div>

            <div className="bg-panel-dark border border-text-main/5 p-6 rounded-2xl shadow-xl flex items-center gap-4 group hover:border-primary/20 transition-all duration-300">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl">receipt_long</span>
              </div>
              <div>
                <p className="text-xs text-text-muted font-bold uppercase tracking-wider">Total Incidentes</p>
                <h3 className="text-2xl font-black text-text-main mt-1">
                  {totalIncidents}
                </h3>
              </div>
            </div>

            <div className="bg-panel-dark border border-text-main/5 p-6 rounded-2xl shadow-xl flex items-center gap-4 group hover:border-accent-gold/20 transition-all duration-300">
              <div className="size-12 rounded-xl bg-accent-gold/10 flex items-center justify-center text-accent-gold group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl">group</span>
              </div>
              <div>
                <p className="text-xs text-text-muted font-bold uppercase tracking-wider">Modelas Involucradas</p>
                <h3 className="text-2xl font-black text-text-main mt-1">
                  {involvedModels}
                </h3>
              </div>
            </div>

            <div className="bg-panel-dark border border-text-main/5 p-6 rounded-2xl shadow-xl flex items-center gap-4 group hover:border-blue-500/20 transition-all duration-300">
              <div className="size-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl">error_med</span>
              </div>
              <div>
                <p className="text-xs text-text-muted font-bold uppercase tracking-wider">Desvío Máximo</p>
                <h3 className="text-2xl font-black text-text-main mt-1">
                  {maxSingleLeak.toLocaleString()} TK
                </h3>
              </div>
            </div>
          </div>

          {/* Controles de Filtro */}
          <div className="bg-panel-dark p-6 rounded-2xl border border-text-main/5 flex flex-col md:flex-row gap-4 items-center justify-between shadow-lg">
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[20px]">search</span>
              <input
                type="text"
                placeholder="Buscar por creadora o destino..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-text-main/5 border border-text-main/10 rounded-lg text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 bg-text-main/5 border border-text-main/10 rounded-lg px-3 py-1.5 w-full sm:w-auto">
                <span className="text-xs text-text-muted font-bold">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-sm text-text-main focus:outline-none w-full sm:w-auto"
                />
              </div>

              <div className="flex items-center gap-2 bg-text-main/5 border border-text-main/10 rounded-lg px-3 py-1.5 w-full sm:w-auto">
                <span className="text-xs text-text-muted font-bold">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-sm text-text-main focus:outline-none w-full sm:w-auto"
                />
              </div>

              {(startDate || endDate || searchQuery) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="px-4 py-2 bg-text-main/5 hover:bg-text-main/10 text-xs font-bold text-text-main rounded-lg transition-colors border border-text-main/10 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Fugas */}
          <div className="bg-panel-dark border border-text-main/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-text-main/5 border-b border-text-main/10 uppercase tracking-widest text-[10px] font-black text-text-muted">
                    <th className="px-8 py-5">Creadora (Modelo)</th>
                    <th className="px-8 py-5">Fecha / Hora</th>
                    <th className="px-8 py-5">Cantidad desviada</th>
                    <th className="px-8 py-5">Usuario de Destino</th>
                    <th className="px-8 py-5">Acción</th>
                    <th className="px-8 py-5">Archivo de Origen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center text-slate-500 italic">
                        Cargando y sincronizando transacciones sospechosas...
                      </td>
                    </tr>
                  ) : filteredTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center text-slate-500 italic">
                        No se detectaron transacciones de fuga en el periodo o filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredTransfers.map((t) => (
                      <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="text-text-main font-bold group-hover:text-primary transition-colors">
                              {t.modelName}
                            </span>
                            <span className="text-text-muted text-xs">@{t.modelNickname}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-text-muted">
                          <div className="flex flex-col">
                            <span className="font-bold">{t.date}</span>
                            <span className="text-xs">{t.time}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full font-bold text-xs">
                            {t.amount.toLocaleString()} TK
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="font-mono text-xs text-text-main bg-text-main/5 px-2.5 py-1.5 rounded-lg border border-text-main/5">
                            {t.recipient === "" || !isNaN(Number(t.recipient)) || t.recipient.startsWith("-")
                              ? "Retiro Directo / Cash Out"
                              : t.recipient}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-text-muted text-xs uppercase tracking-tighter">
                          {t.action}
                        </td>
                        <td className="px-8 py-5 text-[11px] text-slate-500 font-mono">
                          {t.fileName}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
