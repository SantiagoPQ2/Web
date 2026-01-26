// Tipos de datos para la aplicación
export interface ClienteData {
  numero: string;

  // Columnas actuales
  columnaB: string; // Deuda
  columnaC: string; // Situación
  columnaD: string; // Promos legacy (columna D)

  // Nuevas columnas (no rompen nada si no existen)
  columnaE?: string; // Promos Estratégicas
  columnaF?: string; // Promos Operativas
  columnaG?: string; // Promos Escalas

  // Campo ya existente en tu app
  razon_social?: string;
}

export interface ExcelData {
  [numeroCliente: string]: ClienteData;
}

export interface AppState {
  data: ExcelData | null;
  loading: boolean;
  error: string | null;
  searchTerm: string;
  searchResult: ClienteData | null;
}
