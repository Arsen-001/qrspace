"use client";
import { useEffect } from "react";
import { Oops } from "@/components/Oops";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return <Oops retry={retry} />;
}
