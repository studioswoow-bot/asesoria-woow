"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, limit } from "firebase/firestore";

export default function TestConnectionPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function testPull() {
      try {
        console.log("Iniciando prueba de lectura desde la coleccion 'models'...");
        const q = query(collection(db, "models"), limit(5));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          setError("La colección 'models' está vacía o no existe.");
        } else {
          const modelsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setData(modelsList);
        }
      } catch (err: any) {
        console.error("Error en la prueba:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    testPull();
  }, []);

  return (
    <div className="p-8 bg-background-dark min-h-screen text-white">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-primary/20 rounded-xl">
            <span className="material-symbols-outlined text-primary">analytics</span>
          </div>
          <div>
            <h1 className="text-3xl font-black">Prueba de Conectividad</h1>
            <p className="text-slate-400">Verificando acceso de solo lectura al catálogo actual...</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-3 p-4 bg-sidebar-dark rounded-xl border border-primary/20">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
            <span>Conectando con Firebase estudioswoow-7288e...</span>
          </div>
        )}

        {error && (
          <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <div className="flex items-center gap-2 text-red-500 mb-2 font-bold uppercase text-xs">
              <span className="material-symbols-outlined text-sm">error</span> Fallo de Conexión
            </div>
            <p className="text-slate-300">{error}</p>
            <p className="text-xs text-slate-500 mt-4 italic">
              Nota: Asegúrate de que las reglas de Firebase permitan la lectura y que el usuario esté autenticado si es necesario.
            </p>
          </div>
        )}

        {data.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-500 mb-2 font-bold uppercase text-xs animate-pulse">
              <span className="material-symbols-outlined text-sm">verified</span> Conexión Exitosa - Datos Recuperados
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.map((model) => (
                <div key={model.id} className="p-5 bg-sidebar-dark rounded-2xl border border-primary/10 hover:border-primary/30 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-mono text-slate-500">ID: {model.id}</span>
                    <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-black rounded uppercase">
                      {model.status || "Sin Estado"}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{model.name}</h3>
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <span className="material-symbols-outlined text-xs">alternate_email</span>
                    <span>Apodo: <span className="text-primary font-bold">{model.nickname || "N/A"}</span></span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-primary/5 rounded-xl border border-primary/20">
              <p className="text-sm text-slate-400">
                <strong className="text-white">Detección de Aislamiento:</strong> Se han recuperado {data.length} registros. Esta prueba confirma que podemos leer el <code className="bg-primary/20 px-1 rounded">nickname</code> para vincular los datos nuevos sin riesgo de modificar la base original.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
