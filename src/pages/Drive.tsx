import React, { useState } from 'react';
import { Save, AlertCircle, CheckCircle, Calendar, User, FileText } from 'lucide-react';

interface FormData {
  cliente: string;
  motivo: string;
  fecha: string;
}

interface FormErrors {
  cliente?: string;
  motivo?: string;
  fecha?: string;
}

const Drive: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    cliente: '',
    motivo: '',
    fecha: ''
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.cliente.trim()) {
      newErrors.cliente = 'El campo Cliente es obligatorio';
    }

    if (!formData.motivo.trim()) {
      newErrors.motivo = 'El campo Motivo es obligatorio';
    }

    if (!formData.fecha) {
      newErrors.fecha = 'La fecha es obligatoria';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Limpiar mensaje anterior
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
      const response = await fetch('/api/rechazos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [formData.cliente, formData.motivo, formData.fecha]
        }),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      setMessage({ type: 'success', text: '✅ Registro enviado correctamente' });
      
      // Limpiar formulario después del éxito
      setFormData({ cliente: '', motivo: '', fecha: '' });
      setErrors({});

    } catch (error) {
      console.error('Error al enviar datos:', error);
      setMessage({ 
        type: 'error', 
        text: '❌ Error al guardar. Verifique su conexión e intente nuevamente.' 
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
            <h1 className="text-2xl font-bold text-gray-900">Drive - Registro de Rechazos</h1>
            <p className="text-gray-600">Registre información de rechazos en Google Sheets</p>
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

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campo Cliente */}
          <div>
            <label htmlFor="cliente" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4 mr-1" />
              Cliente
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

          {/* Campo Motivo */}
          <div>
            <label htmlFor="motivo" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4 mr-1" />
              Motivo
            </label>
            <textarea
              id="motivo"
              value={formData.motivo}
              onChange={(e) => handleInputChange('motivo', e.target.value)}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors resize-vertical ${
                errors.motivo ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Describa el motivo del rechazo"
              disabled={loading}
            />
            {errors.motivo && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.motivo}
              </p>
            )}
          </div>

          {/* Campo Fecha */}
          <div>
            <label htmlFor="fecha" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4 mr-1" />
              Fecha
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
                  Guardar Registro
                </>
              )}
            </button>
          </div>
        </form>

        {/* Información adicional */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Nota:</strong> Los datos se guardarán directamente en Google Sheets. 
            Asegúrese de que toda la información sea correcta antes de enviar.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Drive;