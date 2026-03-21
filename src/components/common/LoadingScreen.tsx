"use client";

import React from 'react';

interface LoadingScreenProps {
  message?: string;
  fullPage?: boolean;
}

export default function LoadingScreen({ message = "Cargando...", fullPage = false }: LoadingScreenProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
      <div className="relative">
        {/* Outer Glow */}
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse"></div>
        
        {/* Rotating Logo */}
        <div className="relative size-24 md:size-32 animate-[spin_3s_linear_infinite]">
          <img 
            src="/logo-studio.webp" 
            alt="WooW Studio" 
            className="size-full object-contain drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]"
          />
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-2">
        <p className="text-primary font-black uppercase tracking-[0.2em] text-[10px] md:text-xs animate-pulse">
          {message}
        </p>
        <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-primary animate-[loading-bar_2s_ease-in-out_infinite]"></div>
        </div>
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[200] bg-background-dark flex items-center justify-center p-8">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full py-20 flex items-center justify-center">
      {content}
    </div>
  );
}
