"use client";
import { BRAND } from "@subastas-ve/shared";
import { LegalDoc, Sec } from "../../components/ui/LegalDoc";

export default function PrivacidadPage() {
  return (
    <LegalDoc titulo="Privacidad" actualizado="julio de 2026">
      <p style={{ fontSize: "0.88rem", lineHeight: 1.62, color: "var(--ink-2)", marginBottom: 22 }}>
        En {BRAND.name} cuidamos tus datos y pedimos solo lo necesario para que la app
        funcione. Aquí te explicamos, claro y sin letra chiquita, qué guardamos y para qué.
      </p>

      <Sec n={1} titulo="Qué datos guardamos">
        Los que nos das al registrarte y usar la app: nombre, correo, teléfono/WhatsApp,
        ciudad y foto de perfil (opcional). Y los que se generan al usarla: tus pujas,
        órdenes, saldo, calificaciones y —si activas las notificaciones— un identificador
        para poder enviártelas.
      </Sec>

      <Sec n={2} titulo="Para qué los usamos">
        Para operar tu cuenta, procesar las subastas y las órdenes, avisarte lo importante
        (te superaron, ganaste, tu recarga), cuidar la seguridad de la plataforma y prevenir
        fraudes. Nada más.
      </Sec>

      <Sec n={3} titulo="Qué ven los demás">
        Son <strong>públicos</strong>: tu nombre, tu foto y tu reputación. Son{" "}
        <strong>privados</strong>: tu correo y tu teléfono. La única excepción: cuando cierras
        una compra, el vendedor ve tu nombre y tu WhatsApp (y tú los de él) para poder coordinar
        la entrega. <strong>No vendemos tus datos</strong> a nadie.
      </Sec>

      <Sec n={4} titulo="Con quién se procesan">
        Nos apoyamos en proveedores de confianza que procesan datos por nosotros: Google
        Firebase (inicio de sesión, base de datos y notificaciones) y Vercel (alojamiento del
        sitio). Se rigen por sus propias políticas de seguridad.
      </Sec>

      <Sec n={5} titulo="Notificaciones">
        Si aceptas los avisos, guardamos un identificador de tu dispositivo o navegador para
        enviártelos. Puedes desactivarlos cuando quieras desde Ajustes, y dejamos de tener a
        dónde enviarlos.
      </Sec>

      <Sec n={6} titulo="Tu control">
        Puedes editar tu perfil en cualquier momento. Si quieres corregir o eliminar tus
        datos, o borrar tu cuenta, escríbenos y lo gestionamos.
      </Sec>

      <Sec n={7} titulo="Seguridad y menores">
        Tomamos medidas razonables para proteger tu información, aunque ninguna plataforma es
        100 % infalible. {BRAND.name} es solo para mayores de edad.
      </Sec>

      <Sec n={8} titulo="Cambios y contacto">
        Podemos actualizar esta política; si el cambio es importante, te avisaremos. ¿Preguntas
        sobre tus datos? Escríbenos a{" "}
        <a href={`mailto:${BRAND.supportEmail}`} style={{ color: "var(--accent-strong)", fontWeight: 700 }}>{BRAND.supportEmail}</a>.
      </Sec>
    </LegalDoc>
  );
}
