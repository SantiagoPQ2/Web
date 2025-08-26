// Configuración de la aplicación
export const CONFIG = {
  // URL del archivo Excel en GitHub (CAMBIAR POR TU URL)
  EXCEL_FILE_URL: 'https://github.com/tu-usuario/tu-repositorio/blob/main/datos-clientes.xlsx',
  
  // Configuración de la aplicación
  APP_NAME: 'Consulta de Clientes Excel',
  VERSION: '1.0.0',
  
  // Mensajes de la aplicación
  MESSAGES: {
    LOADING: 'Cargando datos desde GitHub...',
    ERROR_GENERIC: 'Ocurrió un error inesperado',
    ERROR_NETWORK: 'Error de conexión. Verifique su conexión a internet.',
    ERROR_FILE_FORMAT: 'El formato del archivo no es válido',
    SEARCH_PLACEHOLDER: 'Ingrese el número de cliente...',
  }
};