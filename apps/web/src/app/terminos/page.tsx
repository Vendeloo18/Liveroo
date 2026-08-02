"use client";
import { BRAND } from "@subastas-ve/shared";
import { LegalDoc, Sec } from "../../components/ui/LegalDoc";

export default function TerminosPage() {
  return (
    <LegalDoc titulo="Términos y Condiciones" actualizado="julio de 2026">
      <p style={{ fontSize: "0.88rem", lineHeight: 1.62, color: "var(--ink-2)", marginBottom: 22 }}>
        Al usar {BRAND.name} aceptas estos términos. {BRAND.name} está en una etapa
        de <strong>beta por invitación</strong>: es un producto en evolución y estas
        reglas pueden cambiar. Léelas con calma antes de ofertar o recargar.
      </p>

      <Sec n={1} titulo={`Qué es ${BRAND.name}`}>
        {BRAND.name} es una plataforma que conecta a compradores con vendedores mediante
        ventas en vivo y ventas por ofertas, hechas en Venezuela. Nosotros ponemos el espacio y las
        herramientas; <strong>la compraventa ocurre directamente entre el comprador y
        el vendedor</strong>. {BRAND.name} no es dueño de los productos ni parte del
        contrato de compraventa.
      </Sec>

      <Sec n={2} titulo="Tu cuenta">
        Para participar necesitas una cuenta con datos veraces. Eres responsable de todo
        lo que ocurra desde ella y de mantener tu contraseña segura. Es solo para mayores
        de edad.
      </Sec>

      <Sec n={3} titulo="Cómo funcionan las ventas por ofertas">
        Cada oferta hecha con SUBELOO es un <strong>compromiso real de compra</strong>: si tu oferta
        queda de primera al cierre, te llevas el producto y se crea una orden a tu nombre. El precio se congela en bolívares
        a la tasa vigente en ese momento. Si alguien mejora el precio en los últimos segundos, el reloj
        puede estirarse para que nadie gane por sorpresa.
      </Sec>

      <Sec n={4} titulo="Billetera y recargas">
        Durante la beta, usar SUBELOO puede requerir <strong>saldo en tu billetera</strong>. Las
        recargas se acreditan a mano una vez que el equipo verifica tu pago. El saldo solo
        sirve para respaldar ofertas y pagar dentro de {BRAND.name}. Al quedar primero con saldo, el monto se
        descuenta automáticamente y tu orden queda pagada.{" "}
        <strong>Las recargas no son reembolsables</strong>: no se devuelve saldo ni pagos.
        El bono de bienvenida es un crédito promocional de USD 1 por usuario,
        no retirable y utilizable únicamente dentro de {BRAND.name} para respaldar ofertas.
        Recarga solo lo que pienses usar.
      </Sec>

      <Sec n={5} titulo="Pagos y entregas">
        El <strong>vendedor es responsable</strong> de entregar el producto tal como lo
        publicó. Comprador y vendedor coordinan la entrega directamente (por ejemplo, por
        WhatsApp). {BRAND.name} no almacena, transporta ni inspecciona los productos, y no
        garantiza su calidad, autenticidad ni la puntualidad de la entrega.
      </Sec>

      <Sec n={6} titulo="Sin cancelaciones ni reembolsos">
        En esta etapa, las órdenes <strong>no se cancelan ni se reembolsan</strong> una vez
        creadas. Piensa bien antes de usar SUBELOO: una oferta ganadora es una compra.
      </Sec>

      <Sec n={7} titulo="Conducta">
        No está permitido: publicar o vender artículos ilegales, robados o prohibidos;
        suplantar a otra persona; manipular ofertas con cuentas falsas; ni usar la
        plataforma para estafar. Podemos retirar publicaciones y suspender cuentas que
        incumplan.
      </Sec>

      <Sec n={8} titulo="Vendedores">
        Ser vendedor requiere aprobación manual. Los vendedores responden por lo que
        publican y por cumplir cada entrega. {BRAND.name} puede cobrar una comisión por
        venta, que se muestra al vendedor, y puede suspender a quien incumpla.
      </Sec>

      <Sec n={9} titulo="Responsabilidad">
        {BRAND.name} se ofrece “tal cual”, en beta. No somos responsables por disputas,
        daños o pérdidas derivados de tratos entre usuarios; aun así, si algo sale mal,
        escríbenos por soporte y te ayudamos a mediar en lo que podamos.
      </Sec>

      <Sec n={10} titulo="Cambios y contacto">
        Podemos actualizar estos términos; si el cambio es importante, te avisaremos.
        ¿Dudas? Escríbenos a{" "}
        <a href={`mailto:${BRAND.supportEmail}`} style={{ color: "var(--accent-strong)", fontWeight: 700 }}>{BRAND.supportEmail}</a>.
      </Sec>
    </LegalDoc>
  );
}
