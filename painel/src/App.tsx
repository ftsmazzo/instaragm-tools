import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Postador } from "./pages/Postador";

// Páginas (placeholders por enquanto)
function PageAdmin() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Administração</h1>
      <p className="text-gray-600 mt-2">Tokens Instagram, dados da empresa, configurações gerais.</p>
    </div>
  );
}
function PagePostagens() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Postagens</h1>
      <p className="text-gray-600 mt-2">Visualização das postagens e botão de raspagem.</p>
    </div>
  );
}
function PageAgentes() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Agentes e leads</h1>
      <p className="text-gray-600 mt-2">Configuração e visualização dos agentes, leads e conversas.</p>
    </div>
  );
}
function PagePerfil() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Perfil</h1>
      <p className="text-gray-600 mt-2">Dados do usuário, alteração de senha e login.</p>
    </div>
  );
}
function PageWhatsApp() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Conexão WhatsApp</h1>
      <p className="text-gray-600 mt-2">Instância e conexão de WhatsApp.</p>
    </div>
  );
}

const nav = [
  { path: "/", label: "Início" },
  { path: "/admin", label: "Administração" },
  { path: "/postagens", label: "Postagens" },
  { path: "/agentes", label: "Agentes e leads" },
  { path: "/postador", label: "Postador" },
  { path: "/perfil", label: "Perfil" },
  { path: "/whatsapp", label: "WhatsApp" },
];

function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-56 bg-white border-r border-gray-200 p-4">
        <div className="font-semibold text-gray-800 mb-6">FabriaIA</div>
        <nav className="space-y-1">
          {nav.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`block px-3 py-2 rounded-md text-sm ${
                loc.pathname === path ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}

function Home() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Painel FabriaIA</h1>
      <p className="text-gray-600 mt-2">Use o menu para acessar Administração, Postagens, Agentes, Postador, Perfil e WhatsApp.</p>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<PageAdmin />} />
        <Route path="/postagens" element={<PagePostagens />} />
        <Route path="/agentes" element={<PageAgentes />} />
        <Route path="/postador" element={<Postador />} />
        <Route path="/perfil" element={<PagePerfil />} />
        <Route path="/whatsapp" element={<PageWhatsApp />} />
      </Routes>
    </Layout>
  );
}
