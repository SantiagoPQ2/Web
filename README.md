# Aplicación de Consulta de Datos Excel

Una aplicación web moderna que permite consultar datos de clientes cargando automáticamente un archivo Excel desde GitHub.

## 🚀 Características

- ✅ Carga automática de archivos Excel desde GitHub
- ✅ Búsqueda en tiempo real por número de cliente
- ✅ Procesamiento automático de texto (conversión de comas a saltos de línea)
- ✅ Interfaz responsive y moderna
- ✅ Manejo robusto de errores
- ✅ Optimizado para rendimiento

## 📋 Estructura del Archivo Excel

El archivo Excel debe tener **al menos 4 columnas** (se usarán solo las primeras 4):

- **Columna A**: Número de cliente (campo clave para búsquedas)
- **Columna B**: Información que se muestra tal como aparece
- **Columna C**: Contenido que se procesa automáticamente (comas → saltos de línea)
- **Columna D**: Contenido que se procesa automáticamente (comas → saltos de línea)

### Ejemplo de estructura:
```
| A (Número) | B (Info)        | C (Detalles)           | D (Datos)        | E... | F... |
|------------|-----------------|------------------------|------------------|
| 12345      | Cliente VIP     | item1, item2, item3    | dato1, dato2     | ... | ... |
| 67890      | Cliente Regular | servicio1, servicio2   | info1, info2     | ... | ... |
```

**Nota:** Si tu archivo tiene más de 4 columnas, la aplicación solo utilizará las primeras 4 (A, B, C, D) e ignorará el resto.

## 🛠️ Configuración

### 1. Preparar el archivo Excel

1. Crea un archivo Excel con la estructura mencionada arriba
2. Guarda el archivo como `.xlsx`
3. Asegúrate de que los datos estén en la primera hoja

### 2. Subir a GitHub

1. Crea un repositorio en GitHub (puede ser público o privado)
2. Sube tu archivo Excel al repositorio
3. Copia la URL del archivo (ejemplo: `https://github.com/tu-usuario/tu-repo/blob/main/datos.xlsx`)

### 3. Configurar la aplicación

1. Abre el archivo `src/config/constants.ts`
2. Cambia la URL por la de tu archivo:

```typescript
export const CONFIG = {
  EXCEL_FILE_URL: 'https://github.com/tu-usuario/tu-repositorio/blob/main/tu-archivo.xlsx',
  // ... resto de configuración
};
```

## 📦 Instalación y Desarrollo

### Requisitos previos
- Node.js (versión 16 o superior)
- npm o yarn

### Instalación
```bash
# Clonar el repositorio
git clone <tu-repositorio>

# Entrar al directorio
cd consulta-excel-app

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev
```

## 🌐 Deployment en Netlify

### Método 1: Deploy directo desde GitHub

1. Ve a [Netlify](https://netlify.com) y registrate
2. Conecta tu cuenta de GitHub
3. Selecciona el repositorio de tu aplicación
4. Configura los ajustes de build:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Haz click en "Deploy site"

### Método 2: Deploy manual

1. Ejecuta el build local:
   ```bash
   npm run build
   ```

2. Arrastra la carpeta `dist` a Netlify

### Configuración adicional para GitHub privado

Si tu archivo Excel está en un repositorio privado:

1. En Netlify, ve a "Site settings" > "Environment variables"
2. Agrega las variables necesarias para autenticación con GitHub
3. Modifica el código para usar tokens de acceso si es necesario

## 🔧 Personalización

### Cambiar colores y estilos

Los estilos están definidos con Tailwind CSS. Puedes personalizar:

- **Colores principales**: Modifica las clases de color en los componentes
- **Tipografía**: Ajusta las clases de texto en `src/index.css`
- **Layout**: Modifica los componentes individuales

### Agregar validaciones adicionales

En `src/utils/excelProcessor.ts` puedes:

- Agregar validaciones de formato para los números de cliente
- Implementar filtros adicionales
- Personalizar el procesamiento de texto

### Modificar mensajes

Todos los mensajes están centralizados en `src/config/constants.ts`:

```typescript
MESSAGES: {
  LOADING: 'Tu mensaje personalizado...',
  ERROR_GENERIC: 'Mensaje de error personalizado...',
  // ... más mensajes
}
```

## 🧪 Testing

Para ejecutar tests (si los implementas):

```bash
npm run test
```

## 📄 Estructura del Proyecto

```
src/
├── components/          # Componentes React reutilizables
│   ├── LoadingSpinner.tsx
│   ├── ErrorMessage.tsx
│   ├── SearchBox.tsx
│   ├── ClientResult.tsx
│   └── EmptyState.tsx
├── hooks/              # Hooks personalizados
│   └── useExcelData.ts
├── utils/              # Utilidades y funciones helper
│   └── excelProcessor.ts
├── types/              # Definiciones de tipos TypeScript
│   └── index.ts
├── config/             # Configuración de la aplicación
│   └── constants.ts
├── App.tsx             # Componente principal
├── main.tsx           # Punto de entrada
└── index.css          # Estilos globales
```

## 🐛 Solución de Problemas

### El archivo Excel no se carga

1. Verifica que la URL sea correcta y accesible
2. Asegúrate de que el archivo tenga exactamente 4 columnas
3. Revisa que el archivo no esté corrupto

### Error de CORS

- GitHub Raw URLs normalmente no tienen problemas de CORS
- Verifica que uses la URL raw correcta (se convierte automáticamente)

### Datos no aparecen después de la búsqueda

1. Verifica que el número de cliente exista en la columna A
2. Asegúrate de que no haya espacios extra en los datos
3. Revisa la consola del navegador para errores

### Problemas de rendimiento

- Para archivos muy grandes (>1000 filas), considera implementar paginación
- Usa lazy loading si tienes muchas imágenes o contenido pesado

## 📝 Notas Técnicas

- **Formato soportado**: .xlsx (Excel 2007+)
- **Tamaño máximo recomendado**: 5MB
- **Navegadores soportados**: Chrome, Firefox, Safari, Edge (versiones modernas)
- **Librerías principales**: React, TypeScript, SheetJS, Tailwind CSS

## 📞 Soporte

Si encuentras problemas:

1. Revisa la consola del navegador para errores
2. Verifica que el archivo Excel tenga el formato correcto
3. Comprueba que la URL de GitHub sea accesible

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.