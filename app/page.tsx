'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { CorbadoAuth } from '@corbado/react';
import { ShieldCheck, Fingerprint, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // NOUVEAU: Permet de basculer entre Mot de passe et FaceID
  const [authMode, setAuthMode] = useState<'standard' | 'biometric'>('standard');
  
  const router = useRouter();

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(''); 
    setIsLoading(true); 

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg("Identifiants incorrects. Veuillez réessayer.");
      setIsLoading(false);
    } else if (data.user) {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
      
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-green-300 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>

      <div className="max-w-md w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white p-8 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white p-3 rounded-2xl shadow-sm mb-6 border border-gray-100">
            <img src="/logo.png" alt="Logo Interact Tunisie" style={{ width: "auto", height: "80px" }} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 text-center tracking-tight">Portail de Coordination</h2>
          <div className="flex items-center gap-1 text-sm font-medium text-interact-blue mt-2 bg-blue-50 px-3 py-1 rounded-full">
            <ShieldCheck size={16} /><span>Accès Restreint</span>
          </div>
        </div>

        {authMode === 'standard' ? (
          <>
            {errorMsg && (
              <div className="mb-6 p-4 bg-red-50/80 border-l-4 border-red-500 text-red-700 rounded-r-lg text-sm font-medium shadow-sm">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleStandardLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Adresse Email</label>
                <input 
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border-gray-200 p-3 border outline-none bg-gray-50 focus:bg-white shadow-sm"
                  required disabled={isLoading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Mot de passe</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border-gray-200 p-3 border outline-none bg-gray-50 focus:bg-white shadow-sm pr-12"
                    required disabled={isLoading}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 text-gray-400">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="w-full bg-interact-blue text-white py-3 px-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex justify-center items-center gap-2">
                {isLoading ? <><Loader2 className="animate-spin" size={20} /> Authentification...</> : "Se Connecter"}
              </button>
            </form>

            <div className="mt-6 flex justify-center border-t border-gray-200 pt-6">
              <button 
                onClick={() => setAuthMode('biometric')} 
                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3 px-4 rounded-xl font-bold shadow-md hover:bg-gray-800 transition-all"
              >
                <Fingerprint size={20} /> Se connecter avec FaceID
              </button>
            </div>
          </>
        ) : (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4">
            <button 
              onClick={() => setAuthMode('standard')} 
              className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 font-bold transition-colors"
            >
              <ArrowLeft size={16} /> Retour au mot de passe
            </button>
            
            {/* Le widget FaceID qui prend le relais */}
            <CorbadoAuth onLoggedIn={() => router.push('/dashboard')} />
          </div>
        )}
      </div>
    </div>
  );
}