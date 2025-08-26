// Tipos de datos para la aplicación
export interface ClienteData {
  numero: string;
  columnaB: string;
  columnaC: string;
  columnaD: string;
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