import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle, Calendar, User, Package } from 'lucide-react';

interface FormData {
  fechaEntrega: string;
  cliente: string;
  codigoArticulo: string;
  bultosTotal: string;
}

interface FormErrors {
  fechaEntrega?: string;
  cliente?: string;
  codigoArticulo?: string;
  bultosTotal?: string;
}

const NotasCredito: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    fechaEntrega: '',
    cliente: '',
    codigoArticulo: '',
    bultosTotal: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fecha de entrega por defecto = hoy
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, fechaEntrega: today }));
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.fechaEntrega) {
      newErrors.fechaEntrega = 'La fecha de entrega es obligatoria';
    }

    if (!formData.cliente.trim()) {
      newErrors.cliente = 'El campo Cliente es obligatorio';
    }

    if (!formData.codigoArticulo.trim()) {
      newErrors.codigoArticulo = 'El campo Código Artículo es obligatorio';
    }

    if (!formData.bultosTotal.trim()) {
      newErrors.bultosTotal = 'El campo Bultos Total es obligatorio';
    } else if (isNaN(Number(formData.bultosTotal)) || Number(formData.bultosTotal) <= 0) {
      newErrors.bultosTotal = 'Debe ser un número válido mayor a 0';
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
    if (!validateForm()) return;

    setLoading(true);
    setMessage(null);

    try {
      const orderedData = {
        fechaEntrega: formData.fechaEntrega,
        cliente: formData.cliente.trim(),
        codigoArticulo: formData.codigoArticulo.trim(),
        bultosTotal: formData.bultosTotal.trim()
      };

      const response = await fetch('/.netlify/functions/notas-credito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderedData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      await response.json();
      setMessage({ type: 'success', text: '✅ Nota de crédito registrada correctamente en Google Sheets' });

      // Reset
      const today = new Date().toISOString().split('T')[0];
      setFormData({ fechaEntrega: today, cliente: '', codigoArticulo: '', bultosTotal: '' });
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
        {/* Header */}
        <div className="flex items-center mb-6">
          <div className="bg-red-100 rounded-full p-2 mr-3">
            <Save className="h-6 w-6 text-red-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notas de Crédito</h1>
            <p className="text-gray-600">Registrar notas de crédito en Google Sheets</p>
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
          {/* Fecha */}
          <div>
            <label htmlFor="fechaEntrega" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4 mr-1" />
              Fecha Entrega <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="fechaEntrega"
              value={formData.fechaEntrega}
              onChange={(e) => handleInputChange('fechaEntrega', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                errors.fechaEntrega ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            {errors.fechaEntrega && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.fechaEntrega}</p>}
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
              placeholder="Nombre del cliente"
              disabled={loading}
            />
            {errors.cliente && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.cliente}</p>}
          </div>

          {/* Código Artículo */}
          <div>
            <label htmlFor="codigoArticulo" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Package className="h-4 w-4 mr-1" />
              Código Artículo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="codigoArticulo"
              value={formData.codigoArticulo}
              onChange={(e) => handleInputChange('codigoArticulo', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                errors.codigoArticulo ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Ejemplo: 823132"
              disabled={loading}
            />
            {errors.codigoArticulo && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.codigoArticulo}</p>}
          </div>

          {/* Bultos Total */}
          <div>
            <label htmlFor="bultosTotal" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Package className="h-4 w-4 mr-1" />
              Bultos Total <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="bultosTotal"
              value={formData.bultosTotal}
              onChange={(e) => handleInputChange('bultosTotal', e.target.value)}
              min="1"
              step="1"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${
                errors.bultosTotal ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Ejemplo: 20"
              disabled={loading}
            />
            {errors.bultosTotal && <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1" />{errors.bultosTotal}</p>}
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
                  Guardar Nota de Crédito
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NotasCredito;
