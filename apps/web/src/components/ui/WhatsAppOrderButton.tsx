"use client";

import {
  buildWhatsappMessage,
  buildWhatsappLink,
  formatUsd,
  formatBs,
  type Order,
} from "@subastas-ve/shared";

interface WhatsAppOrderButtonProps {
  order: Order;
  productTitle: string;
  showTitle: string;
}

export function WhatsAppOrderButton({
  order,
  productTitle,
  showTitle,
}: WhatsAppOrderButtonProps) {
  const message = buildWhatsappMessage({
    buyerName: order.buyerName,
    productTitle,
    bidAmountUsd: order.bidAmountUsd,
    bidAmountBs: order.bidAmountBs,
    frozenRate: order.frozenExchangeRate,
    orderId: order.id,
    showTitle,
  });

  const sellerWhatsapp = order.sellerWhatsapp ?? "";
  const link = sellerWhatsapp
    ? buildWhatsappLink(sellerWhatsapp, message)
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex flex-col gap-3">
      <div>
        <p className="font-bold text-gray-900 text-lg">🏆 ¡Ganaste!</p>
        <p className="text-sm text-gray-600 mt-1">
          Coordina el pago con el vendedor vía WhatsApp
        </p>
      </div>

      <div className="bg-white rounded-xl p-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Producto</span>
          <span className="font-medium text-gray-900">{productTitle}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Monto USD</span>
          <span className="font-bold text-gray-900">{formatUsd(order.bidAmountUsd)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Monto Bs</span>
          <span className="font-medium text-gray-700">{formatBs(order.bidAmountBs)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Tasa congelada</span>
          <span className="text-gray-400">{order.frozenExchangeRate} Bs/USD</span>
        </div>
      </div>

      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold py-3 px-4 rounded-xl transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
        </svg>
        Contactar por WhatsApp
      </a>

      <p className="text-xs text-center text-gray-400">
        Métodos: Pago Móvil · Transferencia · Zelle · Binance · Efectivo
      </p>
    </div>
  );
}
