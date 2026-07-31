import "./admin.css";

// La consola de administración vive en su propio layout: importa su CSS y
// ocupa toda la pantalla, sin la barra inferior de la app (ver
// BottomNavWrapper, que se oculta en /admin).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
