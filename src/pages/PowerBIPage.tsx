import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const PowerBIPage: React.FC = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [loading, setLoading] = useState(true);

  // 🔐 Solo admins pueden acceder
  useEffect(() => {
  if (user?.role !== "admin" && user?.role !== "supervisor") {
    navigate("/informacion");
  }
}, [user, navigate]);


  // ✅ Link público de Power BI (modo "Publicar en la web")
  //    + parámetros para ocultar barras y paneles
  const reportUrl =
    "https://app.powerbi.com/reportEmbed?reportId=3ff79265-8477-4d5c-bdc4-50894b07a79e&autoAuth=true&ctid=78b9b159-c25f-4af4-a2bb-c8f20ab43386";

  return (
    <div className="p-4 md:p-6 space-y-4 w-full h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">

      {/* Loader mientras se carga */}
      {loading && (
        <div className="flex items-center justify-center flex-1">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-red-600 border-opacity-70" />
        </div>
      )}

      {/* Iframe del dashboard */}
      <div className="flex-1 w-full">
        <iframe
          title="Dashboard Power BI"
          src={reportUrl}
          className={`w-full h-full rounded-lg shadow-lg border-0 ${
            loading ? "hidden" : "block"
          }`}
          style={{
            minHeight: "80vh",
            height: "calc(100vh - 120px)", // ocupa casi toda la pantalla
          }}
          allowFullScreen
          onLoad={() => setLoading(false)} // Oculta el loader al cargar
        ></iframe>
      </div>
    </div>
  );
};

export default PowerBIPage;
