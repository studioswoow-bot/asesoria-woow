export async function saveProfileHistory(modelId: string, profileData: any) {
  try {
    // Intentamos obtener el token si está en el contexto o localStorage (depende de tu auth)
    // Para simplificar, la API maneja la escritura si el endpoint es alcanzable.
    const response = await fetch('/api/history/archive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ modelId, profileData }),
    });

    if (!response.ok) {
      throw new Error(`Fallo al archivar en servidor: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ Histórico archivado con éxito:`, result);
  } catch (error) {
    console.error("❌ Error al guardar histórico de perfil (Drive/Firestore):", error);
  }
}
