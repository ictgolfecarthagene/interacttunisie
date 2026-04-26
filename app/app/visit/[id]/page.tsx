// app/visit/[id]/page.tsx
'use client';
import { useParams } from 'next/navigation';

export default function VisitReceiptPage() {
  const params = useParams();
  const visitId = params.id; // This will be "12345"

  // You can now use supabase.from('visits').select('*').eq('id', visitId) 
  // to fetch the specific digital receipt and show it on screen!

  return (
    <div className="p-8">
      <h1>Rapport de Visite ID: {visitId}</h1>
    </div>
  );
}