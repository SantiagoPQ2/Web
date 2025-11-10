import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const PowerBIPage: React.FC = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [loading, setLoading] = useState(true);

  // 🚫 Solo admins pueden acceder
  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/informacion");
    }
  }, [user, navigate]);

  // ✅ Link válido generado desde Power BI (embed seguro)
  const reportUrl =
    "https://app.powerbi.com/view?r=eyJrIjoiNTA2MWIwNzEtYjQxYy00ZmMzLThjZjQtZDJjODRlM2JhNjM5IiwidCI6Ijc4YjliMTU5LWMyNWYtNGFmNC1hMmJiLWM4ZjIwYWI0MzM4NiIsImMiOjR9";

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        📊 Dashboard Power BI
      </h1>

      {/* Loader simple mientras el iframe carga */}
      {loading && (
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-red-600 border-opacity-70"></div>
        </div>
      )}

      <iframe
        title="Dashboard Power BI"
        src={reportUrl}
        className={`w-full h-[85vh] rounded-xl shadow-lg border ${
          loading ? "hidden" : "block"
        }`}
        style={{ border: "none" }}
        allowFullScreen
        onLoad={() => setLoading(false)} // 🔹 Oculta el spinner al cargar
      ></iframe>
    </div>
  );
};

export default PowerBIPage;
