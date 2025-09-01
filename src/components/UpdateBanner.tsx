import React from "react";

interface Props {
  onReload: () => void;
}

const UpdateBanner: React.FC<Props> = ({ onReload }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-white p-4 flex justify-between items-center shadow-lg z-50">
      <span>⚡ Hay una nueva versión disponible.</span>
      <button
        onClick={onReload}
        className="bg-white text-yellow-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100"
      >
        Actualizar
      </button>
    </div>
  );
};

export default UpdateBanner;
