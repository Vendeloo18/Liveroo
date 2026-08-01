/** @type {import('next').NextConfig} */

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    // Las PÁGINAS siempre se piden a la red primero: con caché primero, un
    // despliegue nuevo tardaba en llegar al teléfono y el usuario lo vivía
    // como "no se cargó el cambio". La copia guardada queda solo de
    // respaldo para cuando no hay señal.
    {
      urlPattern: ({ request }) => request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "paginas",
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
    {
      urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
      handler: "NetworkFirst",
      options: { cacheName: "firestore-cache" },
    },
    {
      urlPattern: /^https:\/\/storage\.googleapis\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "firebase-storage",
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  // No hay por qué anunciar el framework en cada respuesta
  poweredByHeader: false,
  transpilePackages: ["@subastas-ve/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin"],
  },
  // Cabeceras de seguridad básicas. CSP queda pendiente a propósito: exige
  // una lista blanca cuidadosa (Firebase, Agora, Vercel) y mal puesta
  // tumba el video en vivo — se hará con calma en su propia pasada.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
