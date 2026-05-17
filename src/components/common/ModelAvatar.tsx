"use client";

import React, { useState } from 'react';
import Image from 'next/image';

interface ModelAvatarProps {
  name: string;
  nickname?: string;
  photoUrl?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export default function ModelAvatar({ name, nickname, photoUrl, className = '', size = 'md' }: ModelAvatarProps) {
  const [imgError, setImgError] = useState(false);

  // Determinar iniciales (2 letras max)
  const initials = (name || nickname || "?")
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Mapear el size a clases de tailwind para el ancho y alto
  const sizeClasses = {
    'sm': 'size-8 text-xs',
    'md': 'size-12 text-sm',
    'lg': 'size-16 text-xl',
    'xl': 'size-20 text-2xl',
    '2xl': 'size-32 text-4xl',
    '3xl': 'size-40 text-5xl',
  };

  const selectedSize = sizeClasses[size];

  // Si tenemos foto y no ha fallado la carga, renderizamos un contenedor con la imagen
  if (photoUrl && !imgError) {
    return (
      <div className={`relative rounded-full overflow-hidden shrink-0 border-4 border-panel-dark/20 shadow-xl ${selectedSize} ${className}`}>
        {/* Usamos img en lugar de next/image temporalmente para evitar problemas con dominios no configurados en next.config.js */}
        <img 
          src={photoUrl} 
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback: mostrar iniciales con estilo premium
  return (
    <div className={`relative shrink-0 rounded-full bg-gradient-to-tr from-primary via-accent-gold to-amber-200 p-[2px] shadow-xl shadow-primary/20 ${selectedSize} ${className}`}>
      <div className="size-full rounded-full bg-panel-dark flex items-center justify-center font-black text-primary border-2 border-panel-dark overflow-hidden">
        {initials}
      </div>
    </div>
  );
}
