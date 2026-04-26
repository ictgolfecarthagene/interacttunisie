'use client';
import { CorbadoProvider } from '@corbado/react';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CorbadoProvider projectId={process.env.NEXT_PUBLIC_CORBADO_PROJECT_ID || "pro-6404309444468139215"}>
      {children}
    </CorbadoProvider>
  );
}