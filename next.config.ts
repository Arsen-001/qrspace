import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Телефон в той же сети открывает дев-сервер по адресу компьютера — чтобы скан кода работал до выкладки.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  // Защита: сайт не встроить в чужую страницу (обманный клик по «Купить»), браузер не угадывает тип файлов,
  // чужим сайтам не уходит полный адрес (в нём бывает id кода), только https; камера и место — только наши страницы.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), usb=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
