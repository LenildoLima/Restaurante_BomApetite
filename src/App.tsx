import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicRoute } from "@/components/PublicRoute";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import NewSale from "./pages/NewSale";
import Sales from "./pages/Sales";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import EsqueciSenha from "./pages/EsqueciSenha";
import UsersPage from "./pages/Users";
import Perfil from "./pages/Perfil";
import Auditoria from "./pages/Auditoria";
import Caixa from "./pages/Caixa";
import Entregadores from "./pages/Entregadores";
import Entregas from "./pages/Entregas";
import Entradas from "./pages/Entradas";
import KDS from "./pages/KDS";
import Backup from "./pages/Backup";
import Catalogo from "./pages/Catalogo";
import ProductSales from "./pages/ProductSales";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Catálogo público — sem login, sem AppLayout */}
            <Route path="/catalogo" element={<Catalogo />} />

            {/* Rota pública: redireciona para home se já autenticado */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/cadastro"
              element={
                <PublicRoute>
                  <Cadastro />
                </PublicRoute>
              }
            />
            <Route
              path="/esqueci-senha"
              element={
                <PublicRoute>
                  <EsqueciSenha />
                </PublicRoute>
              }
            />

            {/* Rotas protegidas dentro do layout */}    
            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Perfil />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/produtos"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Products />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/nova-venda"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <NewSale />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/new-sale"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <NewSale />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cozinha"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <KDS />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/vendas"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Sales />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Sales />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute apenasAdmin>
                  <AppLayout>
                    <UsersPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/caixa"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Caixa />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/entregas"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Entregas />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/entregadores"
              element={
                <ProtectedRoute apenasAdmin>
                  <AppLayout>
                    <Entregadores />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/auditoria"
              element={
                <ProtectedRoute apenasAdmin>
                  <AppLayout>
                    <Auditoria />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/backup"
              element={
                <ProtectedRoute apenasAdmin>
                  <AppLayout>
                    <Backup />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/entradas"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Entradas />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/vendas-produtos"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProductSales />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
