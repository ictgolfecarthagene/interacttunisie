'use client';

import { CorbadoProvider } from '@corbado/react';
import type { ReactNode } from 'react';

const CorbadoProviderFixed = CorbadoProvider as unknown as React.FC<{
  projectId: string;
  children?: ReactNode;
}>;

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <CorbadoProviderFixed
      projectId={
        process.env.NEXT_PUBLIC_CORBADO_PROJECT_ID ||
        'pro-6404309444468139215'
      }
    >
      {children}
    </CorbadoProviderFixed>
  );
}