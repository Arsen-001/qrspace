import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Телефон в той же сети открывает дев-сервер по адресу компьютера — чтобы скан кода работал до выкладки.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
};

export default nextConfig;
