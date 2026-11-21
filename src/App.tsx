import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Carregando, ProvedorAvisos } from './components/ui';
import { Cadastro, Login } from './pages/Acesso';

// Cada área carrega só o código dela: o cliente na mesa não baixa a gestão inteira.
const Landing = lazy(() => import('./pages/Landing'));
const Mesa = lazy(() => import('./pages/cliente/Mesa'));
const EscanearMesa = lazy(() => import('./pages/cliente/Escanear'));
const Garcom = lazy(() => import('./pages/garcom/Garcom'));
const Admin = lazy(() => import('./pages/admin/Admin'));
const LayoutGestao = lazy(() => import('./pages/gestao/Layout'));
const Mesas = lazy(() => import('./pages/gestao/Mesas'));
const Pedidos = lazy(() => import('./pages/gestao/Pedidos'));
const Garcons = lazy(() => import('./pages/gestao/Garcons'));
const Historico = lazy(() => import('./pages/gestao/Historico'));
const Caixa = lazy(() => import('./pages/gestao/Caixa'));
const Notas = lazy(() => import('./pages/gestao/Notas'));
const Cardapio = lazy(() => import('./pages/gestao/Cardapio'));
const Escanear = lazy(() => import('./pages/gestao/Escanear'));
const Estoque = lazy(() => import('./pages/gestao/Estoque'));
const Identidade = lazy(() => import('./pages/gestao/Identidade'));
const QrCodes = lazy(() => import('./pages/gestao/QrCodes'));
const Restaurante = lazy(() => import('./pages/gestao/Restaurante'));
const NotaFiscal = lazy(() => import('./pages/gestao/NotaFiscal'));
const Contrato = lazy(() => import('./pages/gestao/Contrato'));

export default function App() {
  return (
    <ProvedorAvisos>
      <BrowserRouter>
        <Suspense fallback={<Carregando tela />}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/cliente" element={<EscanearMesa />} />
            {/* Mesmos endereços dos QR Codes já impressos */}
            <Route path="/cliente/:rid/mesa/:numero" element={<Mesa />} />
            <Route path="/garcom/:rid" element={<Garcom />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/gestao" element={<LayoutGestao />}>
              <Route index element={<Navigate to="mesas" replace />} />
              <Route path="mesas" element={<Pagina><Mesas /></Pagina>} />
              <Route path="pedidos" element={<Pagina><Pedidos /></Pagina>} />
              <Route path="garcons" element={<Pagina><Garcons /></Pagina>} />
              <Route path="historico" element={<Pagina><Historico /></Pagina>} />
              <Route path="caixa" element={<Pagina><Caixa /></Pagina>} />
              <Route path="notas" element={<Pagina><Notas /></Pagina>} />
              <Route path="cardapio" element={<Pagina><Cardapio /></Pagina>} />
              <Route path="escanear" element={<Pagina><Escanear /></Pagina>} />
              <Route path="estoque" element={<Pagina><Estoque /></Pagina>} />
              <Route path="identidade" element={<Pagina><Identidade /></Pagina>} />
              <Route path="qrcodes" element={<Pagina><QrCodes /></Pagina>} />
              <Route path="restaurante" element={<Pagina><Restaurante /></Pagina>} />
              <Route path="nota-fiscal" element={<Pagina><NotaFiscal /></Pagina>} />
              <Route path="contrato" element={<Pagina><Contrato /></Pagina>} />
              <Route path="*" element={<Navigate to="mesas" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ProvedorAvisos>
  );
}

/** Mantém o menu da gestão na tela enquanto a página carrega. */
function Pagina({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Carregando />}>{children}</Suspense>;
}
