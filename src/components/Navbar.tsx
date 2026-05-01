import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Receipt, 
  Menu, 
  X, 
  Bike, 
  LogOut, 
  UserCircle, 
  Shield, 
  Wallet, 
  ShoppingBag, 
  ChevronDown, 
  Settings, 
  UserCog,
  User,
  PackagePlus,
  ChefHat,
  Database,
  BarChart3
} from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useOnlineOrders, requestNotificationPermission } from "@/hooks/useOnlineOrders";

const dropdownGroups = [
  {
    name: "Vendas",
    icon: ShoppingBag,
    items: [
      { title: "Nova Venda", url: "/nova-venda", icon: ShoppingCart, color: "#16a34a", perfis: ["admin", "atendente"] },
      { title: "Produtos Vendidos", url: "/vendas-produtos", icon: BarChart3, color: "#D4521A", perfis: ["admin"] },
      { title: "Cozinha (KDS)", url: "/cozinha", icon: ChefHat, color: "#f59e0b", perfis: ["admin", "atendente", "cozinheiro"] },
      { title: "Vendas", url: "/vendas", icon: Receipt, color: "#2563eb", perfis: ["admin", "atendente"] },
      { title: "Entregas", url: "/entregas", icon: Bike, color: "#db2777", perfis: ["admin", "atendente"] },
    ]
  },
  {
    name: "Gestão",
    icon: Package,
    items: [
      { title: "Produtos", url: "/produtos", icon: Package, color: "#d97706", perfis: ["admin"] },
      { title: "Entradas", url: "/entradas", icon: PackagePlus, color: "#059669", perfis: ["admin"] },
      { title: "Entregadores", url: "/entregadores", icon: Bike, color: "#0891b2", perfis: ["admin"] },
    ]
  },
  {
    name: "Financeiro",
    icon: Wallet,
    items: [
      { title: "Caixa", url: "/caixa", icon: Wallet, color: "#15803d", perfis: ["admin", "atendente"] },
    ]
  }
];

export function Navbar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const { usuario, logout } = useAuth();
  const { pendingCount } = useOnlineOrders();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (usuario) {
      requestNotificationPermission();
    }
  }, [usuario]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setOpenDropdown(null);
    setIsOpen(false);
  }, [location.pathname]);

  const getFilteredGroups = () => {
    return dropdownGroups.map(group => ({
      ...group,
      items: group.items.filter(item => !usuario || item.perfis.includes(usuario.perfil))
    })).filter(group => group.items.length > 0);
  };

  const filteredGroups = getFilteredGroups();
  const primeiroNome = usuario?.nome?.split(" ")[0] ?? "";
  const iniciais = (usuario?.nome?.[0] || "U").toUpperCase();
  const isAdmin = usuario?.perfil === "admin";

  const isGroupActive = (items: { url: string }[]) => {
    return items.some(item => location.pathname === item.url);
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-gradient-to-r from-[#f97316] to-[#ea580c] shadow-[0_4px_20px_rgba(249,115,22,0.4)] border-none h-16">
      <div className="container mx-auto px-4 h-full">
        <div className="flex h-full items-center justify-between">
          {/* ESQUERDA - Logo (Visível em Desktop e Mobile) */}
          <Link to={usuario?.perfil === "cozinheiro" ? "/cozinha" : "/"} className="flex flex-col group transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-[#1e3a8a]/20 backdrop-blur-sm shadow-xl flex items-center justify-center text-[22px] md:text-[28px] border border-white/10 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
                <img src="/logo-bom-apetite.png" alt="Logo" style={{ width: 28, height: 28, objectFit: "contain" }} />
              </div>
              <div>
                <div className="flex items-baseline leading-none">
                  <span className="font-black text-[20px] md:text-[26px] tracking-tighter text-[#FACC15] drop-shadow-md">Launch</span>
                  <span className="font-light text-[20px] md:text-[26px] tracking-tighter text-white ml-0.5">App</span>
                </div>
                <p className="hidden md:block text-[8.5px] text-[#FACC15] font-black uppercase tracking-[0.35em] mt-0.5 opacity-90">
                  GESTÃO DE LANCHONETE
                </p>
              </div>
            </div>
          </Link>

          {/* DIREITA - Desktop Menu */}
          <div className="hidden md:flex items-center gap-1 h-full" ref={dropdownRef}>
            {usuario?.perfil !== "cozinheiro" && (
              <Link
                to="/"
                className={`flex items-center gap-[0.4rem] h-[48px] px-4 rounded-[0.65rem] transition-all duration-200 text-[0.875rem] font-bold text-white bg-[#7c3aed] ${
                  location.pathname === "/"
                    ? "brightness-[85%] shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                    : "hover:brightness-[115%]"
                }`}
              >
                <LayoutDashboard size={20} className="text-white" />
                Painel
              </Link>
            )}

            {filteredGroups.map((group) => {
              const active = openDropdown === group.name;
              const containsPage = isGroupActive(group.items);

              return (
                <div key={group.name} className="relative h-full flex items-center">
                  <button
                    onClick={() => setOpenDropdown(active ? null : group.name)}
                    className={`flex items-center gap-[0.4rem] h-[48px] px-4 rounded-[0.65rem] transition-all duration-200 text-[0.875rem] font-bold text-white ${
                      containsPage || active
                        ? "brightness-[85%] shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                        : "hover:brightness-[115%]"
                    }`}
                    style={{ 
                      backgroundColor: 
                        group.name === "Vendas" ? "#16a34a" : 
                        group.name === "Gestão" ? "#0891b2" : 
                        "#15803d" // Financeiro
                    }}
                  >
                    <group.icon size={20} className="text-white" />
                    {group.name}
                    {group.name === "Vendas" && pendingCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse border border-white/50" />
                    )}
                    <ChevronDown size={18} className={`text-white transition-transform duration-200 ${active ? "rotate-180" : ""}`} />
                  </button>

                  {active && (
                    <div className="absolute top-[calc(100%-8px)] right-0 w-64 bg-white rounded-[0.75rem] shadow-[0_8px_24px_rgba(0,0,0,0.12)] p-2 animate-in fade-in zoom-in-95 duration-200 z-50">
                      {group.items.map((item) => {
                        const isActive = location.pathname === item.url;
                        return (
                          <Link
                            key={item.title}
                            to={item.url}
                            className={`flex items-center gap-3 p-2 rounded-[0.5rem] transition-all group ${
                              isActive
                                ? "bg-[#f97316] text-white"
                                : "text-[#1e3a8a] whitespace-nowrap hover:bg-[#fff7ed] hover:text-[#f97316]"
                            }`}
                          >
                            <div 
                              style={{ backgroundColor: item.color }} 
                              className="w-8 h-8 flex items-center justify-center rounded-[0.5rem] text-white shadow-sm"
                            >
                              <item.icon size={16} />
                            </div>
                            <span className="font-bold text-sm tracking-tight">{item.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* User Menu (Desktop) */}
            {usuario && (
              <div className="relative h-full flex items-center">
                <button
                  onClick={() => setOpenDropdown(openDropdown === "UserMenu" ? null : "UserMenu")}
                  className={`flex items-center gap-[0.4rem] h-[48px] px-4 rounded-[0.65rem] transition-all duration-200 text-[0.875rem] font-bold text-white bg-[#dc2626] ${
                    openDropdown === "UserMenu" || (isAdmin ? isGroupActive([{url: "/usuarios"}, {url: "/auditoria"}, {url: "/perfil"}]) : location.pathname === "/perfil")
                      ? "brightness-[85%] shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                      : "hover:brightness-[115%]"
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-[10px] border border-white/30 shadow-sm">
                    {iniciais}
                  </div>
                  <span>{isAdmin ? "Administração" : primeiroNome}</span>
                  <ChevronDown size={18} className={`text-white transition-transform duration-200 ${openDropdown === "UserMenu" ? "rotate-180" : ""}`} />
                </button>

                {openDropdown === "UserMenu" && (
                  <div className="absolute top-[calc(100%-8px)] right-0 w-64 bg-white rounded-[0.75rem] shadow-[0_8px_24px_rgba(0,0,0,0.12)] p-2 animate-in fade-in zoom-in-95 duration-200 z-50">
                    {isAdmin && (
                      <>
                        <Link
                          to="/usuarios"
                          className={`flex items-center gap-3 p-2 rounded-[0.5rem] transition-all group ${
                            location.pathname === "/usuarios" ? "bg-[#f97316] text-white" : "text-[#1e3a8a] hover:bg-[#fff7ed] hover:text-[#f97316]"
                          }`}
                        >
                          <div className="w-8 h-8 flex items-center justify-center rounded-[0.5rem] bg-[#dc2626] text-white shadow-sm">
                            <UserCog size={16} />
                          </div>
                          <span className="font-bold text-sm tracking-tight">Usuários</span>
                        </Link>
                        <Link
                          to="/auditoria"
                          className={`flex items-center gap-3 p-2 rounded-[0.5rem] transition-all group mt-1 ${
                            location.pathname === "/auditoria" ? "bg-[#f97316] text-white" : "text-[#1e3a8a] hover:bg-[#fff7ed] hover:text-[#f97316]"
                          }`}
                        >
                          <div className="w-8 h-8 flex items-center justify-center rounded-[0.5rem] bg-[#374151] text-white shadow-sm">
                            <Shield size={16} />
                          </div>
                          <span className="font-bold text-sm tracking-tight">Auditoria</span>
                        </Link>
                        <Link
                          to="/backup"
                          className={`flex items-center gap-3 p-2 rounded-[0.5rem] transition-all group mt-1 ${
                            location.pathname === "/backup" ? "bg-[#f97316] text-white" : "text-[#1e3a8a] hover:bg-[#fff7ed] hover:text-[#f97316]"
                          }`}
                        >
                          <div className="w-8 h-8 flex items-center justify-center rounded-[0.5rem] bg-[#f59e0b] text-white shadow-sm">
                            <Database size={16} />
                          </div>
                          <span className="font-bold text-sm tracking-tight">Backup</span>
                        </Link>
                        <a
                          href="/catalogo"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-2 rounded-[0.5rem] transition-all group mt-1 text-[#1e3a8a] hover:bg-[#fff7ed] hover:text-[#f97316]"
                        >
                          <div className="w-8 h-8 flex items-center justify-center rounded-[0.5rem] bg-[#f97316] text-white shadow-sm">
                            <ShoppingCart size={16} />
                          </div>
                          <span className="font-bold text-sm tracking-tight">Ver Catálogo</span>
                        </a>
                        <div className="h-px bg-gray-100 my-2 mx-1" />
                      </>
                    )}
                    
                    <Link
                      to="/perfil"
                      className={`flex items-center gap-3 p-2 rounded-[0.5rem] transition-all group ${
                        location.pathname === "/perfil" ? "bg-[#f97316] text-white" : "text-[#1e3a8a] hover:bg-[#fff7ed] hover:text-[#f97316]"
                      }`}
                    >
                      <div className="w-8 h-8 flex items-center justify-center rounded-[0.5rem] bg-[#7c3aed] text-white shadow-sm">
                        <User size={16} />
                      </div>
                      <span className="font-bold text-sm tracking-tight">Meu Perfil</span>
                    </Link>

                    <div className="h-px bg-gray-100 my-2 mx-1" />

                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-3 p-2 rounded-[0.5rem] transition-all group text-red-600 hover:bg-red-50"
                    >
                      <div className="w-8 h-8 flex items-center justify-center rounded-[0.5rem] bg-[#dc2626] text-white shadow-sm">
                        <LogOut size={16} />
                      </div>
                      <span className="font-bold text-sm tracking-tight">Sair</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MOBILE TOGGLE (Só visível em Mobile) */}
          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsOpen(true)}
              className="p-1 text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <Menu size={28} />
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] animate-in fade-in duration-300"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Drawer Panel */}
          <div className="fixed top-0 right-0 h-full w-[280px] bg-white z-[101] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header do Drawer */}
            <div className="bg-[#f97316] p-6 relative overflow-hidden">
              <button 
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 text-white p-1 hover:bg-white/10 rounded-lg"
              >
                <X size={24} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-[22px] border border-white/20">
                  <img src="/logo-bom-apetite.png" alt="Logo" style={{ width: 24, height: 24, objectFit: "contain" }} />
                </div>
                <div>
                  <div className="flex items-baseline leading-none">
                    <span className="font-black text-[18px] text-[#FACC15]">Launch</span>
                    <span className="font-light text-[18px] text-white">App</span>
                  </div>
                  <p className="text-[7px] text-[#FACC15] font-black uppercase tracking-widest leading-none mt-1">
                    GESTÃO DE MARMITARIA
                  </p>
                </div>
              </div>

              {usuario && (
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-xs border border-white/30">
                    {iniciais}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-white text-xs font-bold truncate">Olá, {primeiroNome}!</p>
                    <p className="text-white/70 text-[10px] uppercase font-bold tracking-wider">{usuario.perfil}</p>
                  </div>
                </div>
              )}

              {/* Detalhe estético no background do header */}
              <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            </div>

            {/* Conteúdo do Drawer (Scrollable) */}
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
              {/* CATEGORIA: GERAL */}
              {usuario?.perfil !== "cozinheiro" && (
                <div>
                  <p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Geral</p>
                  <DrawerLink to="/" label="Painel" icon={LayoutDashboard} color="#7c3aed" active={location.pathname === "/"} onClick={() => setIsOpen(false)} />
                </div>
              )}

              {/* CATEGORIA: VENDAS */}
              <div>
                <p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Vendas</p>
                <div className="space-y-1">
                  {usuario?.perfil !== "cozinheiro" && (
                    <>
                      <DrawerLink to="/nova-venda" label="Nova Venda" icon={ShoppingCart} color="#16a34a" active={location.pathname === "/nova-venda"} onClick={() => setIsOpen(false)} />
                      <DrawerLink to="/vendas-produtos" label="Produtos Vendidos" icon={BarChart3} color="#D4521A" active={location.pathname === "/vendas-produtos"} onClick={() => setIsOpen(false)} />
                      <DrawerLink to="/vendas" label="Vendas" icon={Receipt} color="#2563eb" active={location.pathname === "/vendas"} onClick={() => setIsOpen(false)} />
                      <DrawerLink to="/entregas" label="Entregas" icon={Bike} color="#db2777" active={location.pathname === "/entregas"} onClick={() => setIsOpen(false)} />
                    </>
                  )}
                  <DrawerLink to="/cozinha" label="Cozinha KDS" icon={ChefHat} color="#d97706" active={location.pathname === "/cozinha"} onClick={() => setIsOpen(false)} />
                </div>
              </div>

              {/* CATEGORIA: GESTÃO */}
              {isAdmin && (
                <div>
                  <p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Gestão</p>
                  <div className="space-y-1">
                    <DrawerLink to="/produtos" label="Produtos" icon={Package} color="#d97706" active={location.pathname === "/produtos"} onClick={() => setIsOpen(false)} />
                    <DrawerLink to="/entregadores" label="Entregadores" icon={Bike} color="#0891b2" active={location.pathname === "/entregadores"} onClick={() => setIsOpen(false)} />
                  </div>
                </div>
              )}

              {/* CATEGORIA: FINANCEIRO */}
              {usuario?.perfil !== "cozinheiro" && (
                <div>
                  <p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Financeiro</p>
                  <DrawerLink to="/caixa" label="Caixa" icon={Wallet} color="#15803d" active={location.pathname === "/caixa"} onClick={() => setIsOpen(false)} />
                </div>
              )}

              {/* CATEGORIA: ADMINISTRAÇÃO */}
              {isAdmin && (
                <div>
                  <p className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Administração</p>
                  <div className="space-y-1">
                    <DrawerLink to="/usuarios" label="Usuários" icon={UserCog} color="#dc2626" active={location.pathname === "/usuarios"} onClick={() => setIsOpen(false)} />
                    <DrawerLink to="/auditoria" label="Auditoria" icon={Shield} color="#374151" active={location.pathname === "/auditoria"} onClick={() => setIsOpen(false)} />
                    <DrawerLink to="/backup" label="Backup de Dados" icon={Database} color="#f59e0b" active={location.pathname === "/backup"} onClick={() => setIsOpen(false)} />
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé do Drawer */}
            <div className="p-3 border-t border-gray-100 bg-gray-50/50">
              <DrawerLink to="/perfil" label="Meu Perfil" icon={User} color="#7c3aed" active={location.pathname === "/perfil"} onClick={() => setIsOpen(false)} />
              <button
                onClick={() => { logout(); setIsOpen(false); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-red-600 font-bold mt-1 hover:bg-red-50"
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <LogOut size={20} />
                </div>
                SAIR
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}

// Sub-componente para links do drawer
function DrawerLink({ to, label, icon: Icon, color, active, onClick }: any) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-xl transition-all min-h-[52px] ${
        active 
          ? "bg-[#fff7ed] text-[#f97316] font-black" 
          : "text-[#1e3a8a] font-bold hover:bg-gray-50"
      }`}
    >
      <div 
        style={{ backgroundColor: active ? "#f97316" : color }} 
        className="w-10 h-10 flex items-center justify-center rounded-xl text-white shadow-sm"
      >
        <Icon size={20} />
      </div>
      <span className="text-sm tracking-tight">{label}</span>
    </Link>
  );
}
