const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar funciones de Google Sheets (asumiendo que tienes utils.js)
// const { appendToSheet, getAllRejections } = require('./utils');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de CORS - Solo permitir el dominio de producción
const corsOptions = {
  origin: [
    'https://vafoodbot.netlify.app',
    'http://localhost:5173', // Para desarrollo local
    'http://localhost:3000'  // Para desarrollo local alternativo
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Middleware de validación para el endpoint de rechazos
const validateRechazosData = (req, res, next) => {
  const { values } = req.body;
  
  if (!values || !Array.isArray(values)) {
    return res.status(400).json({
      success: false,
      error: 'El campo "values" es requerido y debe ser un array'
    });
  }
  
  if (values.length !== 3) {
    return res.status(400).json({
      success: false,
      error: 'Se requieren exactamente 3 valores: [cliente, motivo, fecha]'
    });
  }
  
  const [cliente, motivo, fecha] = values;
  
  if (!cliente || !motivo || !fecha) {
    return res.status(400).json({
      success: false,
      error: 'Todos los campos son obligatorios: cliente, motivo, fecha'
    });
  }
  
  // Validar formato de fecha (YYYY-MM-DD)
  const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!fechaRegex.test(fecha)) {
    return res.status(400).json({
      success: false,
      error: 'La fecha debe tener el formato YYYY-MM-DD'
    });
  }
  
  next();
};

// Endpoint para guardar rechazos
app.post('/api/rechazos', validateRechazosData, async (req, res) => {
  try {
    const { values } = req.body;
    const [cliente, motivo, fecha] = values;
    
    console.log('Recibiendo datos de rechazo:', { cliente, motivo, fecha });
    
    // Aquí llamarías a tu función de Google Sheets
    // const result = await appendToSheet(values);
    
    // Por ahora, simularemos una respuesta exitosa
    // Descomenta la línea de arriba cuando tengas utils.js configurado
    
    // Simulación de guardado exitoso
    console.log('Datos guardados exitosamente en Google Sheets');
    
    res.status(200).json({
      success: true,
      message: 'Registro guardado correctamente',
      data: {
        cliente,
        motivo,
        fecha,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error al guardar en Google Sheets:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al guardar los datos',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Endpoint para obtener todos los rechazos (opcional)
app.get('/api/rechazos', async (req, res) => {
  try {
    // const rejections = await getAllRejections();
    
    // Simulación de datos
    const rejections = [
      { cliente: 'Cliente 1', motivo: 'Motivo 1', fecha: '2024-01-15' },
      { cliente: 'Cliente 2', motivo: 'Motivo 2', fecha: '2024-01-16' }
    ];
    
    res.status(200).json({
      success: true,
      data: rejections
    });
    
  } catch (error) {
    console.error('Error al obtener rechazos:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener los datos'
    });
  }
});

// Endpoint de salud
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Manejo de rutas no encontradas
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado'
  });
});

// Middleware de manejo de errores global
app.use((error, req, res, next) => {
  console.error('Error no manejado:', error);
  
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📝 Endpoints disponibles:`);
  console.log(`   POST /api/rechazos - Guardar rechazo`);
  console.log(`   GET  /api/rechazos - Obtener rechazos`);
  console.log(`   GET  /api/health   - Estado del servidor`);
  console.log(`🌐 CORS configurado para: https://vafoodbot.netlify.app`);
});

module.exports = app;