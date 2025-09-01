import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle, Truck, User, FileText, DollarSign, Calendar } from 'lucide-react';

interface FormData {
  transporte: string;
  cliente: string;
  motivoRechazo: string;
  monto: string;
  fecha: string;
}

interface FormErrors {
  transporte?: string;
  cliente?: string;
  motivoRechazo?: string;
  monto?: string;
  fecha?: string;
}

const RechazosForm: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    transporte: '',
    cliente: '',
    motivoRechazo: '',
    monto: '',
    fecha: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Set fecha actual por defecto
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, fecha: today }));
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.transporte.trim()) {
      newErrors.transporte = 'El campo Transporte es obligatorio';
    }

    if (!formData.cliente.trim()) {
      newErrors.cliente = 'El campo Cliente es obligatorio';
    }

    if (!formData.motivoRechazo.trim()) {
      newErrors.motivoRechazo = 'El campo Motivo de Rechazo es obligatorio';
    }

    if (!formData.monto.trim()) {
      newErrors.monto = 'El campo Monto es obligatorio';
    } else if (isNaN(Number(formData.monto)) || Number(formData.monto) < 0) {
      newErrors.monto = 'Debe ser un número válido mayor o igual a 0';
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
      const orderedData = {
        transporte: formData.transporte.trim(),
        cliente: formData.cliente.trim(),
        motivoRechazo: formData.motivoRechazo.trim(),
        monto: formData.monto.trim(),
        fecha: formData.fecha
      };

      const response = await fetch('/.netlify/functions/rechazos-transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderedData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      await response.json();
      setMessage({ type: 'success', text: '✅ Registro de rechazo enviado correctamente a Google Sheets' });

      const today = new Date().toISOString().split('T')[0];
      setFormData({
        transporte: '',
        cliente: '',
        motivoRechazo: '',
        monto: '',
        fecha: today
      });
      setErrors({});
    } catch (error) {
      console.error('Error al enviar datos:', error);
      setMessage({
        type: 'error',
        text: `❌ Error al guardar: ${error instanceof Error ? error.message : 'Verifique su conexión'}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center mb-6">
          <div className="bg-red-100 rounded-full p-2 mr-3">
            <Save className="h-6 w-6 text-red-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rechazos - Registro</h1>
            <p className="text-gray-600">Registre rechazos de transporte en Google Sheets</p>
          </div>
        </div>

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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Transporte */}
          <div>
            <label htmlFor="transporte" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Truck className="h-4 w-4 mr-1" />
              Transporte <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="transporte"
              value={formData.transporte}
              onChange={(e) => handleInputChange('transporte', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                errors.transporte ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Ingrese el nombre del transporte"
              disabled={loading}
            />
            {errors.transporte && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.transporte}</p>}
          </div>

          {/* Cliente */}
          <div>
            <label htmlFor="cliente" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4 mr-1" />
              Cliente <span className="text-red-500">*</span>
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
            {errors.cliente && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.cliente}</p>}
          </div>

          {/* Motivo */}
          <div>
            <label htmlFor="motivoRechazo" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4 mr-1" />
              Motivo del Rechazo <span className="text-red-500">*</span>
            </label>
            <textarea
              id="motivoRechazo"
              value={formData.motivoRechazo}
              onChange={(e) => handleInputChange('motivoRechazo', e.target.value)}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                errors.motivoRechazo ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Describa el motivo del rechazo"
              disabled={loading}
            />
            {errors.motivoRechazo && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.motivoRechazo}</p>}
          </div>

          {/* Monto */}
          <div>
            <label htmlFor="monto" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="h-4 w-4 mr-1" />
              Monto <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="monto"
              value={formData.monto}
              onChange={(e) => handleInputChange('monto', e.target.value)}
              min="0"
              step="0.01"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                errors.monto ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Monto del rechazo"
              disabled={loading}
            />
            {errors.monto && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.monto}</p>}
          </div>

          {/* Fecha */}
          <div>
            <label htmlFor="fecha" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4 mr-1" />
              Fecha <span className="text-red-500">*</span>
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
            {errors.fecha && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.fecha}</p>}
          </div>

          {/* Botón */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-lg text-white font-medium transition-all duration-200 ${
                loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
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
                  Guardar Rechazo
                </>
              )}
            </button>
          </div>
        </form>

        {/* Información adicional */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Nota:</strong> Los datos se guardarán en Google Sheets en el siguiente orden: 
            Transporte → Cliente → Motivo de Rechazo → Monto → Fecha
          </p>
          <p className="text-xs text-gray-500 mt-2">
            La fecha se completa automáticamente con el día actual, pero puede modificarla si es necesario.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RechazosForm;
