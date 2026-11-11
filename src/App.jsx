import { lazy, Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link, Route, Routes } from "react-router-dom";
import { useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import { AnimatePresence, motion } from "framer-motion";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import useDarkMode from "./hooks/useDarkMode.js";
import SplashScreen from "./components/SplashScreen.jsx";
import LoadingSkeleton from "./components/LoadingSkeleton.jsx";

const About = lazy(() => import("./pages/About.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const AdminLogin = lazy(() => import("./pages/AdminLogin.jsx"));
const Categories = lazy(() => import("./pages/Categories.jsx"));
const CategoryPage = lazy(() => import("./pages/CategoryPage.jsx"));
const Favorites = lazy(() => import("./pages/Favorites.jsx"));
const FactDetail = lazy(() => import("./pages/FactDetail.jsx"));
const Home = lazy(() => import("./pages/Home.jsx"));
const Search = lazy(() => import("./pages/Search.jsx"));
const Shuffle = lazy(() => import("./pages/Shuffle.jsx"));

function NotFound() {
  return <main className="page-wrap page-content"><div className="empty-panel"><span className="empty-icon">404</span><h1>Looks like a wrong turn.</h1><p>Good thing there are plenty of other things to discover.</p><Link className="button button-dark" to="/">Back to FactSphere</Link></div></main>;
}

export default function App() {
  const [darkMode, setDarkMode] = useDarkMode();
  const location = useLocation();
  return (
    <div className="app-shell">
      <SplashScreen />
      <Navbar darkMode={darkMode} onToggleTheme={() => setDarkMode((current) => !current)} />
      <AnimatePresence mode="wait">
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: "easeOut" }}>
          <Suspense fallback={<main className="page-wrap page-content"><LoadingSkeleton count={1} /></main>}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/category/:slug" element={<CategoryPage />} />
              <Route path="/fact/:id" element={<FactDetail />} />
              <Route path="/random" element={<Shuffle />} />
              <Route path="/search" element={<Search />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
      <footer className="site-footer"><div className="page-wrap footer-inner"><Link to="/" className="brand"><span className="brand-mark">f.</span><span>fact<span>sphere</span></span></Link><span>A little wonder goes a long way.</span><div className="footer-links"><Link to="/about">About</Link><Link to="/admin">Fact monitor <ArrowUpRight size={13} /></Link><span>MADE FOR THE CURIOUS ✳</span></div></div></footer>
    </div>
  );
}
