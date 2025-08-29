import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle, Calendar, User, FileText, Package, DollarSign, UserCheck } from 'lucide-react';

interface FormData {
  cliente: string;
  articulo: string;
  bultos: string;
  bonificacion: string;
  nombreVendedor: string;
  fecha: string;
}

interface FormErrors {
  cliente?: string;
  articulo?: string;
  bultos?: string;
  bonificacion?: string;
  nombreVendedor?: string;
  fecha?: string;
}

const Drive: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    cliente: '',
    articulo: '',
    bultos: '',
    bonificacion: '',
    nombreVendedor: '',
    fecha: ''
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-populate current date on component mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, fecha: today }));
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.cliente.trim()) {
      newErrors.cliente = 'El campo Cliente es obligatorio';
    }

    if (!formData.articulo.trim()) {
      newErrors.articulo = 'El campo Artículo es obligatorio';
    }

    if (!formData.bultos.trim()) {
      newErrors.bultos = 'El campo Bultos es obligatorio';
    } else if (isNaN(Number(formData.bultos)) || Number(formData.bultos) <= 0) {
      newErrors.bultos = 'Debe ser un número válido mayor a 0';
    }

    if (!formData.bonificacion.trim()) {
      newErrors.bonificacion = 'El campo Bonificación es obligatorio';
    } else if (isNaN(Number(formData.bonificacion)) || Number(formData.bonificacion) < 0) {
      newErrors.bonificacion = 'Debe ser un número válido mayor o igual a 0';
    }

    if (!formData.nombreVendedor.trim()) {
      newErrors.nombreVendedor = 'El campo Nombre del Vendedor es obligatorio';
    }

    if (!formData.fecha) {
      newErrors.fecha = 'La fecha es obligatoria';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    if (message) {
      setMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Prepare data in exact sequence for Google Sheets
      const orderedData = {
        cliente: formData.cliente.trim(),
        articulo: formData.articulo.trim(),
        bultos: formData.bultos.trim(),
        bonificacion: formData.bonificacion.trim(),
        nombreVendedor: formData.nombreVendedor.trim(),
        fecha: formData.fecha
      };

      const response = await fetch('/.netlify/functions/rechazos', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderedData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      setMessage({ 
        type: 'success', 
        text: '✅ Registro de bonificación enviado correctamente a Google Sheets' 
      });
      
      // Reset form but keep today's date
      const today = new Date().toISOString().split('T')[0];
      setFormData({ 
        cliente: '', 
        articulo: '', 
        bultos: '', 
        bonificacion: '', 
        nombreVendedor: '', 
        fecha: today 
      });
      setErrors({});

    } catch (error) {
      console.error('Error al enviar datos:', error);
      setMessage({ 
        type: 'error', 
        text: `❌ Error al guardar: ${error instanceof Error ? error.message : 'Verifique su conexión e intente nuevamente'}` 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-sm p-6">
        {/* Header */}
        <div className="flex items-center mb-6">
          <div className="bg-red-100 rounded-full p-2 mr-3">
            <Save className="h-6 w-6 text-red-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Drive - Registro de Bonificaciones</h1>
            <p className="text-gray-600">Registre bonificaciones de clientes en Google Sheets</p>
          </div>
        </div>

        {/* Mensaje de estado */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            )}
            <span className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </span>
          </div>
        )}

        {/* Formulario con campos en secuencia específica */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Campo Cliente */}
          <div>
            <label htmlFor="cliente" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4 mr-1" />
              Cliente <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              id="cliente"
              value={formData.cliente}
              onChange={(e) => handleInputChange('cliente', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                errors.cliente ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Ingrese el nombre del cliente"
              disabled={loading}
            />
            {errors.cliente && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.cliente}
              </p>
            )}
          </div>

          {/* 2. Campo Artículo */}
          <div>
            <label htmlFor="articulo" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Package className="h-4 w-4 mr-1" />
              Artículo <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              id="articulo"
              value={formData.articulo}
              onChange={(e) => handleInputChange('articulo', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                errors.articulo ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Ingrese el nombre del artículo/producto"
              disabled={loading}
            />
            {errors.articulo && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.articulo}
              </p>
            )}
          </div>

          {/* 3. Campo Bultos */}
          <div>
            <label htmlFor="bultos" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Package className="h-4 w-4 mr-1" />
              Bultos <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="number"
              id="bultos"
              value={formData.bultos}
              onChange={(e) => handleInputChange('bultos', e.target.value)}
              min="1"
              step="1"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                errors.bultos ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Cantidad de bultos/unidades"
              disabled={loading}
            />
            {errors.bultos && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.bultos}
              </p>
            )}
          </div>

          {/* 4. Campo Bonificación */}
          <div>
            <label htmlFor="bonificacion" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="h-4 w-4 mr-1" />
              Bonificación <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="number"
              id="bonificacion"
              value={formData.bonificacion}
              onChange={(e) => handleInputChange('bonificacion', e.target.value)}
              min="0"
              step="0.01"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                errors.bonificacion ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Monto total de bonificación"
              disabled={loading}
            />
            {errors.bonificacion && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.bonificacion}
              </p>
            )}
          </div>

          {/* 5. Campo Nombre del Vendedor */}
          <div>
            <label htmlFor="nombreVendedor" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <UserCheck className="h-4 w-4 mr-1" />
              Nombre del Vendedor <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              id="nombreVendedor"
              value={formData.nombreVendedor}
              onChange={(e) => handleInputChange('nombreVendedor', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                errors.nombreVendedor ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Ingrese el nombre del vendedor"
              disabled={loading}
            />
            {errors.nombreVendedor && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.nombreVendedor}
              </p>
            )}
          </div>

          {/* 6. Campo Fecha */}
          <div>
            <label htmlFor="fecha" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4 mr-1" />
              Fecha <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="date"
              id="fecha"
              value={formData.fecha}
              onChange={(e) => handleInputChange('fecha', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                errors.fecha ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            {errors.fecha && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.fecha}
              </p>
            )}
          </div>

          {/* Botón de envío */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-lg text-white font-medium transition-all duration-200 ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Bonificación
                </>
              )}
            </button>
          </div>
        </form>

        {/* Información adicional */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Nota:</strong> Los datos se guardarán en Google Sheets en el siguiente orden: 
            Cliente → Artículo → Bultos → Bonificación → Nombre del Vendedor → Fecha
          </p>
          <p className="text-xs text-gray-500 mt-2">
            La fecha se completa automáticamente con el día actual, pero puede modificarla si es necesario.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Drive;
