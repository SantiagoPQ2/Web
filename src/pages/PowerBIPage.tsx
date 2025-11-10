import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const PowerBIPage: React.FC = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Solo permitir acceso a admins
  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/informacion"); // redirige si no es admin
    }
  }, [user, navigate]);

  const reportUrl =
    "https://app.powerbi.com/links/IwwtVSlEqt?ctid=78b9b159-c25f-4af4-a2bb-c8f20ab43386&pbi_source=linkShare";

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">📊 Dashboard Power BI</h1>

      <iframe
        title="Dashboard Power BI"
        src={reportUrl}
        className="w-full h-[85vh] rounded-xl shadow-lg border"
        style={{ border: "none" }}
        allowFullScreen
      ></iframe>
    </div>
  );
};

export default PowerBIPage;
