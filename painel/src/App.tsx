import { Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { HomePage } from "./pages/HomePage";
import { AdminPage } from "./pages/AdminPage";
import { PostagensPage } from "./pages/PostagensPage";
import { AgentesPage } from "./pages/AgentesPage";
import { PerfilPage } from "./pages/PerfilPage";
import { WhatsAppPage } from "./pages/WhatsAppPage";
import { Postador } from "./pages/Postador";

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/postagens" element={<PostagensPage />} />
        <Route path="/agentes" element={<AgentesPage />} />
        <Route path="/postador" element={<Postador />} />
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="/whatsapp" element={<WhatsAppPage />} />
      </Routes>
    </AppLayout>
  );
}
