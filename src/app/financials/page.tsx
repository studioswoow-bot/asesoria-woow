"use client";

import React from "react";

export default function FinancialsPage() {
  return (
    <div className="p-8">
      <div className="mb-10">
        <h2 className="text-3xl font-display font-bold text-white mb-2">Finanzas y Pagos</h2>
        <p className="text-slate-400">Panel de control financiero, liquidaciones y balances de modelos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { title: "Total Generado", value: "$12,450.00", icon: "payments", color: "text-green-500" },
          { title: "Pendiente de Pago", value: "$3,120.00", icon: "pending_actions", color: "text-amber-500" },
          { title: "Comisión Estudio", value: "$4,980.00", icon: "account_balance", color: "text-primary" },
        ].map((card, i) => (
          <div key={i} className="bg-sidebar-dark/50 border border-primary/20 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className={`material-symbols-outlined text-3xl ${card.color}`}>{card.icon}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Este Mes</span>
            </div>
            <div className="text-2xl font-display font-black text-white">{card.value}</div>
            <div className="text-xs text-slate-500 mt-1">{card.title}</div>
          </div>
        ))}
      </div>

      <div className="bg-sidebar-dark/50 rounded-2xl border border-primary/20 p-12 text-center">
        <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl text-primary">analytics</span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Módulo de Liquidación en Preparación</h3>
        <p className="text-slate-400 max-w-md mx-auto mb-8">
          Estamos integrando el motor de cálculo automático para las liquidaciones de modelos basado en los tokens de cada plataforma.
        </p>
        <button className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-6 py-3 rounded-xl font-bold transition-all">
          Saber más sobre la integración
        </button>
      </div>
    </div>
  );
}
