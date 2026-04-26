'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

import { useCorbado, CorbadoAuth, CorbadoProvider } from '@corbado/react';
import { Trophy, Users, FileText, Plus, CheckCircle, Loader2, Fingerprint, Medal, Trash2, Building2, LogOut } from 'lucide-react';

// ==========================================
// CONFIGURATION DES RÔLES ET ZONES OFFICIELS
// ==========================================
const EXECUTIVE_ROLES = [
  'Coordinateur National',
  'Vice Coordinateur',
  'Secrétaire National',
  'Secrétaire National Adjoint',
  'Trésorier',
  'Chef de Protocole'
];

const ZONES = [
  'Nord 1', 'Nord 2', 'Nord 3', 'Nord 4', 'Nord 5', 'Nord 6', 'Nord 7', 'Centre', 'Sud'
];

export default function Dashboard() {
  const { isAuthenticated, user: corbadoUser, loading: corbadoLoading, logout: corbadoLogout } = useCorbado();
  
  const [user, setUser] = useState<any>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  
  const [zoneClubs, setZoneClubs] = useState<string[]>([]); 
  const [allClubs, setAllClubs] = useState<any[]>([]); 
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]); 
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'users' | 'clubs' | 'securite'>('leaderboard');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('Toutes les zones');
  
  const [showReportModal, setShowReportModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [visitReason, setVisitReason] = useState('Réunion Statutaire');
  const [specificReason, setSpecificReason] = useState('');
  const [selectedClub, setSelectedClub] = useState('');
  const [scores, setScores] = useState({ etat: '', effectif: '', organisation: '', deroulement: '', professionnalisme: '' });

  const [newClubName, setNewClubName] = useState('');
  const [newClubZone, setNewClubZone] = useState('');

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('PENDING');
  const [newUserZone, setNewUserZone] = useState('');

  const router = useRouter();

  const isExecutive = user ? EXECUTIVE_ROLES.includes(user.role) : false;

  const fetchVisitsAndLeaderboard = async (role: string, zone: string) => {
    let query = supabase.from('visits').select('*').order('created_at', { ascending: false });
    if (role === 'DRC') query = query.eq('zone', zone);
    
    const { data, error } = await query;
    if (data && !error) {
      setVisits(data);
      const clubStats: Record<string, any> = {};
      data.forEach(visit => {
        if (!clubStats[visit.club_name]) {
          clubStats[visit.club_name] = { club_name: visit.club_name, zone: visit.zone, totalScore: 0, count: 0, last_visitor: visit.visitor_name };
        }
        clubStats[visit.club_name].totalScore += Number(visit.score);
        clubStats[visit.club_name].count += 1;
      });

      const board = Object.values(clubStats).map((club: any) => ({
        ...club, average: (club.totalScore / club.count).toFixed(2)
      })).sort((a: any, b: any) => b.average - a.average);

      setLeaderboard(board);
    }
  };

  const fetchAllClubs = async () => {
    const { data } = await supabase.from('clubs').select('*').order('name');
    if (data) setAllClubs(data);
  };

  const fetchAllUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('full_name');
    if (data) setAllUsers(data);
  };

  useEffect(() => {
    let isMounted = true;
    const failsafeTimer = setTimeout(() => { if (isMounted) setIsAppLoading(false); }, 3000);

    async function fetchDashboardData() {
      const { data: { user: sbUser } } = await supabase.auth.getUser();
      let activeEmail = sbUser?.email;

      if (!activeEmail) {
        if (corbadoLoading) return; 
        if (isAuthenticated && corbadoUser?.email) activeEmail = corbadoUser.email;
      }
      
      if (!activeEmail) {
        if (isMounted) setIsAppLoading(false);
        return;
      }
      
      const { data: userData } = await supabase.from('users').select('*').eq('email', activeEmail).single();
        
      if (userData && isMounted) {
        setUser(userData);
        await fetchVisitsAndLeaderboard(userData.role, userData.zone);

        if (userData.role === 'DRC') {
          const { data: clubsData } = await supabase.from('clubs').select('name').ilike('zone', userData.zone); 
          if (clubsData) setZoneClubs(clubsData.map(club => club.name));
        }
        if (EXECUTIVE_ROLES.includes(userData.role)) {
          await fetchAllUsers();
          await fetchAllClubs();
        }
      }
      
      if (isMounted) {
        setIsAppLoading(false);
        clearTimeout(failsafeTimer);
      }
    }
    
    fetchDashboardData();
    return () => { isMounted = false; clearTimeout(failsafeTimer); };
  }, [isAuthenticated, corbadoUser, corbadoLoading, router]);

  // ==========================================
  // FONCTIONS : GESTION DES UTILISATEURS
  // ==========================================
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return alert("Veuillez remplir le nom et l'email.");
    setIsUpdating(true);

    const payload = {
      full_name: newUserName,
      email: newUserEmail.toLowerCase(),
      role: newUserRole,
      zone: newUserRole === 'DRC' ? newUserZone : null
    };

    const { error } = await supabase.from('users').insert(payload);
    if (!error) {
      setNewUserName(''); setNewUserEmail(''); setNewUserRole('PENDING'); setNewUserZone('');
      await fetchAllUsers();
      alert("Membre pré-enregistré avec succès !");
    } else {
      alert("Erreur: L'email existe déjà ou problème de permissions (RLS).");
    }
    setIsUpdating(false);
  };

  const handleUpdateUser = async (userId: string, field: 'role' | 'zone', value: string) => {
    setIsUpdating(true);
    const updateData: any = { [field]: value };
    if (field === 'role' && value !== 'DRC') updateData.zone = null;
    
    const { error } = await supabase.from('users').update(updateData).eq('id', userId);
    
    if (!error) {
      setAllUsers(allUsers.map(u => u.id === userId ? { ...u, ...updateData } : u));
      if (userId === user.id) {
        setUser({ ...user, ...updateData });
        if (field === 'role' && !EXECUTIVE_ROLES.includes(value)) setActiveTab('leaderboard');
      }
    } else alert("Erreur de mise à jour. Vérifiez le RLS sur Supabase.");
    setIsUpdating(false);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer l'accès de ${userName} ?`)) return;
    setIsUpdating(true);
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (!error) {
      setAllUsers(allUsers.filter(u => u.id !== userId));
      if (userId === user.id) handleLogout(); 
    }
    setIsUpdating(false);
  };

  // ==========================================
  // FONCTIONS : GESTION DES CLUBS & RAPPORTS
  // ==========================================
  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer ce rapport ?`)) return;
    setIsUpdating(true);
    const { error } = await supabase.from('visits').delete().eq('id', reportId);
    if (!error) fetchVisitsAndLeaderboard(user.role, user.zone);
    setIsUpdating(false);
  };

  const handleAddClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClubName || !newClubZone) return alert("Veuillez remplir le nom et la zone.");
    setIsUpdating(true);
    const { error } = await supabase.from('clubs').insert({ name: newClubName, zone: newClubZone });
    if (!error) {
      setNewClubName(''); setNewClubZone('');
      await fetchAllClubs();
      alert("Club ajouté avec succès !");
    }
    setIsUpdating(false);
  };

  const handleDeleteClub = async (clubId: string, clubName: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le club ${clubName} ?`)) return;
    setIsUpdating(true);
    const { error } = await supabase.from('clubs').delete().eq('id', clubId);
    if (!error) await fetchAllClubs();
    setIsUpdating(false);
  };

  const handleSubmitReport = async () => {
    if (!selectedClub) return alert("Veuillez sélectionner un club.");
    const allScores = Object.values(scores).map(Number);
    if (allScores.some(isNaN) || Object.values(scores).some(s => s === '')) return alert("Veuillez remplir toutes les notes.");

    setIsSubmitting(true);
    const averageScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const finalReason = visitReason === 'Autre' ? specificReason : visitReason;

    const payload = {
      club_name: selectedClub, zone: user?.zone || 'Zone Non Définie', visitor_name: user?.full_name || 'Utilisateur', 
      reason: finalReason, score: Number(averageScore.toFixed(2)) 
    };

    const { error } = await supabase.from('visits').insert(payload);
    setIsSubmitting(false);
    
    if (!error) {
      alert("Rapport soumis avec succès ! 🎉");
      setShowReportModal(false); setSelectedClub(''); setSpecificReason('');
      setScores({ etat: '', effectif: '', organisation: '', deroulement: '', professionnalisme: '' });
      fetchVisitsAndLeaderboard(user.role, user.zone);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut(); 
    if (isAuthenticated) await corbadoLogout(); 
    router.push('/');
  };

  const displayedLeaderboard = selectedZoneFilter === 'Toutes les zones' 
    ? leaderboard : leaderboard.filter(c => c.zone === selectedZoneFilter);

  if (isAppLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-interact-blue font-bold">
      <Loader2 className="animate-spin mb-4" size={40} />
      <p className="animate-pulse">Chargement d'Interact Tunisie...</p>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-red-500 font-bold p-4 text-center">
      <p>Session expirée ou non autorisée.</p>
      <button onClick={() => router.push('/')} className="mt-6 px-6 py-3 bg-interact-blue text-white rounded-xl shadow-lg hover:bg-blue-700 transition">Retour à la connexion</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 selection:bg-blue-100">
      
      {/* NAVBAR */}
      <nav className="bg-white/90 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-interact-blue p-2 rounded-xl text-white shadow-inner hidden sm:flex">
              <Trophy size={20} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Interact <span className="text-interact-blue">Tunisie</span></h1>
              <p className="text-xs text-gray-500 font-medium hidden sm:block">Portail de Coordination Nationale</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right hidden md:block">
              <p className="text-gray-900 font-bold leading-none">{user.full_name}</p>
              <p className="text-xs text-gray-500 font-medium mt-1">{user.role === 'DRC' ? `DRC ${user.zone}` : user.role}</p>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 bg-white text-gray-600 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all duration-200">
              <LogOut size={16} className="hidden sm:block" /> Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* TAB NAVIGATION PILLS */}
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200 w-fit overflow-x-auto mx-auto sm:mx-0">
          {isExecutive && (
            <>
              <button onClick={() => setActiveTab('leaderboard')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'leaderboard' ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Trophy size={18} /> Classement</button>
              <button onClick={() => setActiveTab('users')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'users' ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Users size={18} /> Accès</button>
              <button onClick={() => setActiveTab('clubs')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'clubs' ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Building2 size={18} /> Clubs</button>
            </>
          )}
          {user.role === 'DRC' && (
            <button onClick={() => setActiveTab('leaderboard')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'leaderboard' ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><FileText size={18} /> Ma Zone</button>
          )}
          <button onClick={() => setActiveTab('securite')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'securite' ? 'bg-interact-blue text-white shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Fingerprint size={18} /> Sécurité FaceID</button>
        </div>

        {/* ============================== */}
        {/* VIEW: LEADERBOARD & REPORTS    */}
        {/* ============================== */}
        {isExecutive && activeTab === 'leaderboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-gray-50 to-white gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3"><Trophy className="text-yellow-500" size={28} /> Classement National</h2>
                  <p className="text-gray-500 text-sm mt-1">Moyennes calculées sur l'ensemble des rapports soumis.</p>
                </div>
                <select value={selectedZoneFilter} onChange={(e) => setSelectedZoneFilter(e.target.value)} className="border-gray-200 rounded-xl text-gray-700 py-3 px-4 border-2 outline-none bg-white font-bold shadow-sm focus:border-interact-blue focus:ring-4 focus:ring-blue-50 transition-all cursor-pointer w-full md:w-auto">
                  <option value="Toutes les zones">🌍 Toutes les zones</option>
                  {ZONES.map(zone => <option key={zone} value={zone}>📍 {zone}</option>)}
                </select>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50/50 text-gray-400 font-bold border-b border-gray-100 uppercase tracking-widest text-xs">
                    <tr><th className="px-8 py-5">Rang</th><th className="px-8 py-5">Club Interact</th><th className="px-8 py-5">Zone</th><th className="px-8 py-5 text-center">Rapports</th><th className="px-8 py-5">Dernière visite par</th><th className="px-8 py-5 text-right">Moyenne</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedLeaderboard.length > 0 ? displayedLeaderboard.map((club, index) => (
                      <tr key={index} className="hover:bg-blue-50/50 transition-colors group">
                        <td className="px-8 py-5 font-black text-gray-400 flex items-center gap-3">
                          {index === 0 ? <div className="p-1.5 bg-yellow-100 rounded-lg text-yellow-600 shadow-sm"><Medal size={20} /></div> :
                           index === 1 ? <div className="p-1.5 bg-gray-100 rounded-lg text-gray-500 shadow-sm"><Medal size={20} /></div> :
                           index === 2 ? <div className="p-1.5 bg-orange-100 rounded-lg text-orange-700 shadow-sm"><Medal size={20} /></div> : 
                           <span className="w-8 text-center">#{index + 1}</span>}
                        </td>
                        <td className="px-8 py-5 font-bold text-gray-900 text-base">{club.club_name}</td>
                        <td className="px-8 py-5"><span className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200">{club.zone}</span></td>
                        <td className="px-8 py-5 text-center font-bold text-gray-500">{club.count}</td>
                        <td className="px-8 py-5 text-gray-500">{club.last_visitor}</td>
                        <td className="px-8 py-5 font-black text-interact-blue text-right text-xl">{club.average}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="px-8 py-16 text-center text-gray-400 font-medium">Aucun club évalué dans cette zone.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 md:p-8 border-b border-gray-100 flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-xl text-gray-600"><FileText size={20} /></div>
                <h3 className="text-xl font-bold text-gray-900">Derniers rapports soumis</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50/50 text-gray-400 font-bold border-b border-gray-100 text-xs uppercase tracking-widest">
                    <tr><th className="px-8 py-4">Date</th><th className="px-8 py-4">Club</th><th className="px-8 py-4">Motif</th><th className="px-8 py-4">Par</th><th className="px-8 py-4">Note</th><th className="px-8 py-4 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visits.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-8 py-4 text-gray-500 font-medium">{new Date(v.created_at).toLocaleDateString('fr-FR')}</td>
                        <td className="px-8 py-4 font-bold text-gray-900">{v.club_name}</td>
                        <td className="px-8 py-4 text-gray-600">{v.reason}</td>
                        <td className="px-8 py-4 font-medium text-gray-700">{v.visitor_name}</td>
                        <td className="px-8 py-4 font-black text-interact-blue">{v.score}</td>
                        <td className="px-8 py-4 text-right">
                          <button onClick={() => handleDeleteReport(v.id)} disabled={isUpdating} className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-xl hover:bg-red-50">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* VIEW: MANAGE USERS & ADD USERS */}
        {/* ============================== */}
        {isExecutive && activeTab === 'users' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Formulaire stylisé */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-6 md:p-8 relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-interact-blue/5 rounded-bl-full -z-10"></div>
              <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3 mb-6"><div className="bg-green-100 p-2 rounded-xl text-green-600"><Plus size={20} /></div> Pré-enregistrer un Membre</h2>
              
              <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Prénom et Nom" className="lg:col-span-1 border-2 border-gray-200 rounded-xl p-3.5 outline-none focus:border-interact-blue focus:ring-4 focus:ring-blue-50 font-medium transition-all" required />
                <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Adresse email" className="lg:col-span-1 border-2 border-gray-200 rounded-xl p-3.5 outline-none focus:border-interact-blue focus:ring-4 focus:ring-blue-50 font-medium transition-all" required />
                
                <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="lg:col-span-1 border-2 border-gray-200 rounded-xl p-3.5 outline-none focus:border-interact-blue focus:ring-4 focus:ring-blue-50 font-bold text-gray-700 bg-white transition-all cursor-pointer" required>
                  <option value="PENDING">En attente / Sans Rôle</option>
                  <option value="DRC">Directeur de Région (DRC)</option>
                  <optgroup label="Bureau Exécutif">
                    {EXECUTIVE_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                  </optgroup>
                </select>

                <div className="lg:col-span-1">
                  {newUserRole === 'DRC' ? (
                    <select value={newUserZone} onChange={e => setNewUserZone(e.target.value)} className="w-full border-2 border-interact-blue/30 rounded-xl p-3.5 outline-none focus:border-interact-blue focus:ring-4 focus:ring-blue-50 font-bold text-interact-blue bg-blue-50/50 transition-all cursor-pointer" required>
                      <option value="">Sélectionner Zone...</option>
                      {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                  ) : (
                    <div className="w-full border-2 border-gray-100 rounded-xl p-3.5 bg-gray-50 text-gray-400 font-medium text-center cursor-not-allowed">Pas de zone requise</div>
                  )}
                </div>

                <button type="submit" disabled={isUpdating} className="lg:col-span-1 bg-gray-900 hover:bg-black text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all">Ajouter</button>
              </form>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="p-6 md:p-8 border-b border-gray-100 flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-xl text-gray-600"><Users size={20} /></div>
                <h2 className="text-xl font-bold text-gray-900">Gestion des Accès Existants</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50/50 text-gray-400 font-bold border-b border-gray-100 uppercase tracking-widest text-xs">
                    <tr><th className="px-8 py-5">Nom</th><th className="px-8 py-5">Email</th><th className="px-8 py-5">Rôle</th><th className="px-8 py-5">Zone (DRC)</th><th className="px-8 py-5 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-8 py-4 font-bold text-gray-900">{u.full_name}</td>
                        <td className="px-8 py-4 text-gray-500 font-medium">{u.email}</td>
                        <td className="px-8 py-4">
                          <select disabled={isUpdating} value={u.role || 'PENDING'} onChange={(e) => handleUpdateUser(u.id, 'role', e.target.value)} className="border-2 border-gray-200 rounded-xl p-2.5 text-sm bg-white outline-none focus:border-interact-blue focus:ring-4 focus:ring-blue-50 font-bold text-gray-700 w-full max-w-xs transition-all cursor-pointer">
                            <option value="PENDING">En attente</option>
                            <option value="DRC">Directeur de Région (DRC)</option>
                            <optgroup label="Bureau Exécutif">
                              {EXECUTIVE_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                            </optgroup>
                          </select>
                        </td>
                        <td className="px-8 py-4">
                          <select disabled={isUpdating || u.role !== 'DRC'} value={u.zone || ''} onChange={(e) => handleUpdateUser(u.id, 'zone', e.target.value)} className={`border-2 rounded-xl p-2.5 text-sm w-36 outline-none focus:border-interact-blue focus:ring-4 focus:ring-blue-50 font-bold transition-all cursor-pointer ${u.role !== 'DRC' ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border-gray-200 text-gray-700'}`}>
                            <option value="">-- Zone --</option>
                            {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                          </select>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <button onClick={() => handleDeleteUser(u.id, u.full_name)} disabled={isUpdating} className="text-red-500 hover:text-white border-2 border-red-100 hover:border-red-500 hover:bg-red-500 transition-all px-4 py-2 rounded-xl text-xs font-bold shadow-sm">Supprimer</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* VIEW: MANAGE CLUBS             */}
        {/* ============================== */}
        {isExecutive && activeTab === 'clubs' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-6 md:p-8">
              <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3 mb-6"><div className="bg-green-100 p-2 rounded-xl text-green-600"><Plus size={20} /></div> Ajouter un Club</h2>
              <form onSubmit={handleAddClub} className="flex flex-col md:flex-row gap-4">
                <input type="text" value={newClubName} onChange={e => setNewClubName(e.target.value)} placeholder="Nom du Club officiel" className="flex-1 border-2 border-gray-200 rounded-xl p-3.5 outline-none focus:border-interact-blue focus:ring-4 focus:ring-blue-50 font-medium transition-all" required />
                <select value={newClubZone} onChange={e => setNewClubZone(e.target.value)} className="w-full md:w-64 border-2 border-gray-200 rounded-xl p-3.5 outline-none focus:border-interact-blue focus:ring-4 focus:ring-blue-50 font-bold text-gray-700 bg-white transition-all cursor-pointer" required>
                  <option value="">Sélectionner la Zone...</option>
                  {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
                <button type="submit" disabled={isUpdating} className="bg-gray-900 hover:bg-black text-white font-bold py-3.5 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all">Ajouter</button>
              </form>
            </div>
            
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="p-6 md:p-8 border-b border-gray-100 flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-xl text-gray-600"><Building2 size={20} /></div>
                <h2 className="text-xl font-bold text-gray-900">Liste des Clubs Officiels</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50/50 text-gray-400 font-bold border-b border-gray-100 uppercase tracking-widest text-xs">
                    <tr><th className="px-8 py-5">Nom du Club</th><th className="px-8 py-5">Zone Actuelle</th><th className="px-8 py-5 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allClubs.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-8 py-5 font-bold text-gray-900 text-base">{c.name}</td>
                        <td className="px-8 py-5"><span className="bg-blue-50 text-interact-blue border border-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold">{c.zone}</span></td>
                        <td className="px-8 py-5 text-right">
                          <button onClick={() => handleDeleteClub(c.id, c.name)} disabled={isUpdating} className="text-red-500 hover:text-white border-2 border-red-100 hover:border-red-500 hover:bg-red-500 transition-all px-4 py-2 rounded-xl text-xs font-bold shadow-sm">Retirer</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* VIEW: DRC ZONE                 */}
        {/* ============================== */}
        {user.role === 'DRC' && activeTab === 'leaderboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-3 bg-interact-blue"></div>
              <div>
                <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Zone {user.zone}</h2>
                <p className="text-gray-500 font-medium text-lg">Vous avez soumis <span className="text-interact-blue font-black">{visits.length}</span> rapports de visite officiels.</p>
              </div>
              <button onClick={() => setShowReportModal(true)} className="mt-6 md:mt-0 bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 font-bold flex items-center gap-3 transition-all">
                <Plus size={22} /> Nouveau Rapport
              </button>
            </div>
            
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 md:p-8 border-b border-gray-100 flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-xl text-green-600"><CheckCircle size={20} /></div>
                <h3 className="text-xl font-bold text-gray-900">Historique de mes visites</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50/50 text-gray-400 font-bold border-b border-gray-100 uppercase tracking-widest text-xs">
                    <tr><th className="px-8 py-5">Date</th><th className="px-8 py-5">Club</th><th className="px-8 py-5">Motif</th><th className="px-8 py-5 text-right">Score</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visits.length > 0 ? visits.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-8 py-5 text-gray-500 font-medium">{new Date(v.created_at).toLocaleDateString('fr-FR')}</td>
                        <td className="px-8 py-5 font-bold text-gray-900 text-base">{v.club_name}</td>
                        <td className="px-8 py-5 text-gray-600 font-medium">{v.reason}</td>
                        <td className="px-8 py-5 font-black text-interact-blue text-right text-xl">{v.score} <span className="text-sm text-gray-400 font-bold">/ 10</span></td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="p-16 text-center text-gray-400 font-medium">Aucun rapport rédigé pour le moment.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* VIEW: SECURITY / BIOMETRICS    */}
        {/* ============================== */}
        {activeTab === 'securite' && (
          <div className="animate-in fade-in zoom-in-95 duration-500 bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-8 md:p-16 text-center max-w-2xl mx-auto mt-10">
            <div className="mx-auto bg-gradient-to-br from-gray-900 to-black w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-2xl transform rotate-3">
              <Fingerprint className="text-white transform -rotate-3" size={48} />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Enregistrer un Appareil</h2>
            <p className="text-gray-500 mb-10 max-w-md mx-auto leading-relaxed font-medium">
              Associez le FaceID, TouchID ou Windows Hello de cet appareil à votre compte <b className="text-gray-900">{user.email}</b> pour des connexions instantanées.
            </p>
            <div className="border-2 border-gray-100 rounded-3xl p-8 bg-gray-50 shadow-inner flex justify-center items-center">
              <div className="w-full max-w-sm">
                <p className="text-xs font-black text-gray-400 mb-6 uppercase tracking-widest">Zone Biométrique Sécurisée</p>
                {/* @ts-ignore : Ignore le bug TypeScript de Corbado pour Vercel */}
                <CorbadoProvider projectId={process.env.NEXT_PUBLIC_CORBADO_PROJECT_ID || "pro-6404309444468139215"}>
                  <CorbadoAuth onLoggedIn={() => alert('FaceID activé avec succès !')} />
                </CorbadoProvider>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ============================== */}
      {/* MODAL: NEW REPORT (DRC)        */}
      {/* ============================== */}
      {showReportModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur-md z-10">
              <h3 className="text-2xl font-extrabold text-gray-900">Évaluer un Club</h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                &times;
              </button>
            </div>
            
            <div className="p-6 md:p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Sélectionner le Club</label>
                <select value={selectedClub} onChange={(e) => setSelectedClub(e.target.value)} className="w-full border-2 border-gray-200 p-4 rounded-xl bg-gray-50 outline-none focus:border-interact-blue focus:ring-4 focus:ring-blue-50 font-bold text-gray-800 transition-all cursor-pointer">
                  <option value="">-- Choisir un club --</option>
                  {zoneClubs.map((club, i) => <option key={i} value={club}>{club}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Raison de la visite</label>
                <select value={visitReason} onChange={(e) => setVisitReason(e.target.value)} className="w-full border-2 border-gray-200 p-4 rounded-xl bg-gray-50 outline-none focus:border-interact-blue focus:ring-4 focus:ring-blue-50 font-bold text-gray-800 transition-all cursor-pointer">
                  <option value="Réunion Statutaire">Réunion Statutaire</option>
                  <option value="Élections du Bureau Exécutif">Élections du Bureau Exécutif</option>
                  <option value="Autre">Autre</option>
                </select>
                
                {visitReason === 'Autre' && (
                  <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                    <input type="text" placeholder="Précisez la raison de votre visite..." value={specificReason} onChange={(e) => setSpecificReason(e.target.value)} className="w-full border-2 border-gray-200 p-4 rounded-xl bg-white outline-none focus:border-interact-blue focus:ring-4 focus:ring-blue-50 font-medium transition-all"/>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h4 className="font-black text-gray-400 mb-6 bg-gray-50 p-3 rounded-xl text-center text-xs tracking-widest uppercase">Barème de Notation (sur 10)</h4>
                <div className="space-y-4">
                  {[
                    { key: 'etat', label: 'État général du club' }, 
                    { key: 'effectif', label: "Gestion de l'effectif" }, 
                    { key: 'organisation', label: "Organisation interne" }, 
                    { key: 'deroulement', label: "Déroulement de l'action" }, 
                    { key: 'professionnalisme', label: 'Professionnalisme' }
                  ].map((critere, i) => (
                    <div key={i} className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-2xl shadow-sm hover:border-gray-200 transition-colors">
                      <label className="text-sm font-bold text-gray-700 ml-2">{critere.label}</label>
                      <input type="number" min="0" max="10" value={(scores as any)[critere.key]} onChange={(e) => setScores({...scores, [critere.key]: e.target.value})} className="w-24 border-2 border-gray-200 rounded-xl p-3 text-center font-black text-interact-blue text-lg outline-none focus:border-interact-blue focus:ring-4 focus:ring-blue-50 shadow-sm transition-all" placeholder="/ 10" />
                    </div>
                  ))}
                </div>
              </div>
              
              <button onClick={handleSubmitReport} disabled={isSubmitting} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-bold hover:bg-black transition-all flex justify-center items-center gap-3 mt-6 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 disabled:opacity-70 disabled:transform-none text-lg">
                {isSubmitting ? <><Loader2 className="animate-spin" size={24} /> Enregistrement sécurisé...</> : 'Soumettre le rapport officiel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}