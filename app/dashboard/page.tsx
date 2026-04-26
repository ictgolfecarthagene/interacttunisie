'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

import { useCorbado, CorbadoAuth, CorbadoProvider } from '@corbado/react';
import { Trophy, Users, FileText, Plus, CheckCircle, Loader2, Fingerprint, Medal, Trash2, Building2 } from 'lucide-react';

const EXECUTIVE_ROLES = [
  'Coordinateur National',
  'Vice Coordinateur',
  'Secrétaire National',
  'Secrétaire National Adjoint',
  'Trésorier',
  'Chef de Protocole',
  'BUREAU_EXECUTIF' 
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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return alert("Veuillez remplir le nom et l'email.");
    setIsUpdating(true);

    const payload = {
      full_name: newUserName,
      email: newUserEmail.toLowerCase(),
      role: newUserRole === 'PENDING' ? null : newUserRole,
      zone: newUserRole === 'DRC' ? newUserZone : null
    };

    const { error } = await supabase.from('users').insert(payload);
    if (!error) {
      setNewUserName(''); setNewUserEmail(''); setNewUserRole('PENDING'); setNewUserZone('');
      await fetchAllUsers();
      alert("Membre pré-enregistré avec succès ! Il pourra se connecter via FaceID ou en créant un mot de passe.");
    } else {
      alert("Erreur de base de données. Cet email est peut-être déjà enregistré ou RLS est activé.");
      console.error(error);
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
        if (field === 'role' && !EXECUTIVE_ROLES.includes(value)) {
          setActiveTab('leaderboard');
        }
      }
    } else {
      // NEW: Explicit error alert added to prevent silent failures
      console.error("Supabase Update Error:", error);
      alert("Erreur de mise à jour! Avez-vous désactivé le RLS sur la table 'users' ?");
    }
    setIsUpdating(false);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer l'accès de ${userName} ?`)) return;
    setIsUpdating(true);
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (!error) {
      setAllUsers(allUsers.filter(u => u.id !== userId));
      if (userId === user.id) handleLogout(); 
    } else {
      console.error(error);
      alert("Erreur lors de la suppression. Avez-vous désactivé le RLS ?");
    }
    setIsUpdating(false);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer ce rapport ?`)) return;
    setIsUpdating(true);
    const { error } = await supabase.from('visits').delete().eq('id', reportId);
    if (!error) fetchVisitsAndLeaderboard(user.role, user.zone);
    else alert("Erreur lors de la suppression du rapport.");
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
    } else {
      console.error(error);
      alert("Erreur lors de l'ajout. Avez-vous désactivé le RLS sur la table 'clubs' ?");
    }
    setIsUpdating(false);
  };

  const handleDeleteClub = async (clubId: string, clubName: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le club ${clubName} ?`)) return;
    setIsUpdating(true);
    const { error } = await supabase.from('clubs').delete().eq('id', clubId);
    if (!error) await fetchAllClubs();
    else alert("Erreur lors de la suppression du club.");
    setIsUpdating(false);
  };

  const handleSubmitReport = async () => {
    if (!selectedClub) return alert("Veuillez sélectionner un club.");
    const allScores = Object.values(scores).map(Number);
    if (allScores.some(isNaN) || Object.values(scores).some(s => s === '')) return alert("Veuillez remplir toutes les notes sur 10.");
    if (visitReason === 'Autre' && !specificReason.trim()) return alert("Veuillez spécifier la raison.");

    setIsSubmitting(true);
    const averageScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const finalReason = visitReason === 'Autre' ? specificReason : visitReason;

    const payload = {
      club_name: selectedClub, zone: user?.zone || 'Zone Non Définie', visitor_name: user?.full_name || 'Utilisateur', 
      reason: finalReason, score: Number(averageScore.toFixed(2)) 
    };

    const { error } = await supabase.from('visits').insert(payload);
    setIsSubmitting(false);
    
    if (error) alert(`Erreur: Données rejetées. Avez-vous désactivé le RLS ?`); 
    else {
      alert("Rapport soumis avec succès ! 🎉");
      setShowReportModal(false); setSelectedClub(''); setSpecificReason(''); setVisitReason('Réunion Statutaire');
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

  if (isAppLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-interact-blue font-bold animate-pulse">Chargement d'Interact Tunisie...</div>;
  if (!user) return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-red-500 font-bold p-4 text-center"><p>Session expirée ou non autorisée.</p><button onClick={() => router.push('/')} className="mt-6 px-6 py-3 bg-interact-blue text-white rounded-xl shadow-lg">Retour</button></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans text-gray-800">
      
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Logo Interact" style={{ width: "auto", height: "40px" }} />
            <span className="hidden sm:block h-6 w-px bg-gray-300"></span>
            <h1 className="text-lg font-bold text-interact-blue tracking-tight hidden sm:block">Portail de Gestion</h1>
          </div>
          <div className="text-sm font-medium flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-gray-900 font-bold">{user.full_name}</p>
              <p className="text-xs text-gray-500">{user.role === 'DRC' ? `DRC ${user.zone}` : user.role}</p>
            </div>
            <button onClick={handleLogout} className="bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors">Déconnexion</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-fit mb-6 overflow-x-auto">
          {isExecutive && (
            <>
              <button onClick={() => setActiveTab('leaderboard')} className={`flex items-center whitespace-nowrap gap-2 py-2 px-6 rounded-lg font-medium text-sm transition-all ${activeTab === 'leaderboard' ? 'bg-interact-blue text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><Trophy size={18} /> Classement & Visites</button>
              <button onClick={() => setActiveTab('users')} className={`flex items-center whitespace-nowrap gap-2 py-2 px-6 rounded-lg font-medium text-sm transition-all ${activeTab === 'users' ? 'bg-interact-blue text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><Users size={18} /> Gestion Accès</button>
              <button onClick={() => setActiveTab('clubs')} className={`flex items-center whitespace-nowrap gap-2 py-2 px-6 rounded-lg font-medium text-sm transition-all ${activeTab === 'clubs' ? 'bg-interact-blue text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><Building2 size={18} /> Gestion Clubs</button>
            </>
          )}
          {user.role === 'DRC' && (
            <button onClick={() => setActiveTab('leaderboard')} className={`flex items-center whitespace-nowrap gap-2 py-2 px-6 rounded-lg font-medium text-sm transition-all ${activeTab === 'leaderboard' ? 'bg-interact-blue text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><FileText size={18} /> Ma Zone</button>
          )}
          <button onClick={() => setActiveTab('securite')} className={`flex items-center whitespace-nowrap gap-2 py-2 px-6 rounded-lg font-medium text-sm transition-all ${activeTab === 'securite' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><Fingerprint size={18} /> Config. Sécurité</button>
        </div>

        {isExecutive && activeTab === 'leaderboard' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 gap-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Trophy className="text-yellow-500" /> Classement National</h2>
                <select value={selectedZoneFilter} onChange={(e) => setSelectedZoneFilter(e.target.value)} className="border-gray-200 rounded-lg text-gray-700 p-2 border outline-none bg-white font-medium shadow-sm w-full md:w-auto">
                  <option value="Toutes les zones">Toutes les zones</option>
                  {ZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                </select>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white text-gray-500 font-bold border-b border-gray-200 uppercase tracking-wider text-xs">
                    <tr><th className="px-6 py-4">Rang</th><th className="px-6 py-4">Club Interact</th><th className="px-6 py-4">Zone</th><th className="px-6 py-4 text-center">Rapports</th><th className="px-6 py-4">Dernière visite par</th><th className="px-6 py-4 text-right">Moyenne</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedLeaderboard.length > 0 ? displayedLeaderboard.map((club, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-black text-gray-400 flex items-center gap-2">
                          {index === 0 && <Medal className="text-yellow-500" size={20} />}
                          {index === 1 && <Medal className="text-gray-400" size={20} />}
                          {index === 2 && <Medal className="text-amber-700" size={20} />}
                          #{index + 1}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-800">{club.club_name}</td>
                        <td className="px-6 py-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">{club.zone}</span></td>
                        <td className="px-6 py-4 text-center font-medium text-gray-500">{club.count}</td>
                        <td className="px-6 py-4 text-gray-600">{club.last_visitor}</td>
                        <td className="px-6 py-4 font-black text-interact-blue text-right text-lg">{club.average}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">Aucun club n'a encore été évalué dans cette zone.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mt-8">
              <div className="p-6 border-b border-gray-100 flex items-center gap-2">
                <FileText className="text-gray-400" /> <h3 className="font-bold text-gray-800">Derniers rapports soumis</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200 text-xs uppercase">
                    <tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Club</th><th className="px-6 py-3">Motif</th><th className="px-6 py-3">Par</th><th className="px-6 py-3">Note</th><th className="px-6 py-3 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visits.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-gray-500">{new Date(v.created_at).toLocaleDateString('fr-FR')}</td>
                        <td className="px-6 py-3 font-bold">{v.club_name}</td>
                        <td className="px-6 py-3 text-gray-600">{v.reason}</td>
                        <td className="px-6 py-3">{v.visitor_name}</td>
                        <td className="px-6 py-3 font-bold text-interact-blue">{v.score}</td>
                        <td className="px-6 py-3 text-right">
                          <button onClick={() => handleDeleteReport(v.id)} disabled={isUpdating} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50">
                            <Trash2 size={16} />
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

        {isExecutive && activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden p-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4"><Plus className="text-green-500" /> Pré-enregistrer un Membre</h2>
              <form onSubmit={handleAddUser} className="flex flex-col md:flex-row gap-4">
                <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Prénom et Nom" className="flex-1 border border-gray-300 rounded-xl p-3 outline-none focus:border-interact-blue" required />
                <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Adresse email" className="flex-1 border border-gray-300 rounded-xl p-3 outline-none focus:border-interact-blue" required />
                
                <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="border border-gray-300 rounded-xl p-3 outline-none focus:border-interact-blue bg-white" required>
                  <option value="PENDING">Sans Rôle</option>
                  <option value="DRC">DRC</option>
                  <optgroup label="Bureau Exécutif">
                    {EXECUTIVE_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                  </optgroup>
                </select>

                {newUserRole === 'DRC' && (
                  <select value={newUserZone} onChange={e => setNewUserZone(e.target.value)} className="border border-gray-300 rounded-xl p-3 outline-none focus:border-interact-blue bg-white" required>
                    <option value="">Sélectionner une Zone...</option>
                    {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                )}

                <button type="submit" disabled={isUpdating} className="bg-interact-blue hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all">Ajouter</button>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
               <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Users className="text-interact-blue" /> Gestion des Accès Existants</h2>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-sm text-left border rounded-xl overflow-hidden">
                  <thead className="bg-gray-50 text-gray-600 border-b">
                    <tr><th className="px-4 py-3">Nom</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Rôle</th><th className="px-4 py-3">Zone (DRC)</th><th className="px-4 py-3 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold">{u.full_name}</td>
                        <td className="px-4 py-3 text-gray-500">{u.email}</td>
                        <td className="px-4 py-3">
                          <select 
                            disabled={isUpdating} 
                            value={u.role || 'PENDING'} 
                            onChange={(e) => handleUpdateUser(u.id, 'role', e.target.value)} 
                            className="border border-gray-300 rounded-lg p-2 text-sm bg-white outline-none focus:border-interact-blue w-full max-w-xs"
                          >
                            <option value="PENDING">En attente</option>
                            <option value="DRC">Directeur de Région (DRC)</option>
                            <optgroup label="Bureau Exécutif">
                              {EXECUTIVE_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                            </optgroup>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select 
                            disabled={isUpdating || u.role !== 'DRC'} 
                            value={u.zone || ''} 
                            onChange={(e) => handleUpdateUser(u.id, 'zone', e.target.value)} 
                            className={`border rounded-lg p-2 text-sm w-32 outline-none focus:border-interact-blue ${u.role !== 'DRC' ? 'bg-gray-100 text-gray-400' : 'bg-white'}`}
                          >
                            <option value="">-- Zone --</option>
                            {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDeleteUser(u.id, u.full_name)} disabled={isUpdating} className="text-red-500 hover:text-white border border-red-200 hover:bg-red-500 transition-colors px-3 py-1 rounded-lg text-xs font-bold shadow-sm">
                            Supprimer
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

        {isExecutive && activeTab === 'clubs' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden p-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4"><Plus className="text-green-500" /> Ajouter un Club</h2>
              <form onSubmit={handleAddClub} className="flex flex-col md:flex-row gap-4">
                <input type="text" value={newClubName} onChange={e => setNewClubName(e.target.value)} placeholder="Nom du Club (ex: Interact Tunis)" className="flex-1 border border-gray-300 rounded-xl p-3 outline-none focus:border-interact-blue" required />
                <select 
                  value={newClubZone} 
                  onChange={e => setNewClubZone(e.target.value)} 
                  className="w-full md:w-48 border border-gray-300 rounded-xl p-3 outline-none focus:border-interact-blue bg-white" 
                  required
                >
                  <option value="">Zone...</option>
                  {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
                <button type="submit" disabled={isUpdating} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all">Ajouter</button>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
               <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Building2 className="text-interact-blue" /> Liste des Clubs</h2>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-sm text-left border rounded-xl overflow-hidden">
                  <thead className="bg-gray-50 text-gray-600 border-b">
                    <tr><th className="px-4 py-3">Nom du Club</th><th className="px-4 py-3">Zone Actuelle</th><th className="px-4 py-3 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allClubs.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold">{c.name}</td>
                        <td className="px-4 py-3"><span className="bg-blue-50 text-interact-blue border border-blue-100 px-2 py-1 rounded text-xs font-bold">{c.zone}</span></td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDeleteClub(c.id, c.name)} disabled={isUpdating} className="text-red-500 hover:text-white border border-red-200 hover:bg-red-500 transition-colors px-3 py-1 rounded-lg text-xs font-bold shadow-sm">
                            Retirer
                          </button>
                        </td>
                      </tr>
                    ))}
                    {allClubs.length === 0 && <tr><td colSpan={3} className="text-center p-6 text-gray-400">Aucun club trouvé.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {user.role === 'DRC' && activeTab === 'leaderboard' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-green-500"></div>
              <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-1">Zone : {user.zone}</h2>
                <p className="text-gray-500 font-medium">Vous avez soumis <span className="text-interact-blue font-bold">{visits.length}</span> rapports officiels.</p>
              </div>
              <button onClick={() => setShowReportModal(true)} className="mt-4 md:mt-0 bg-interact-blue text-white px-6 py-3 rounded-xl shadow-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all"><Plus size={20} /> Nouveau Rapport</button>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><CheckCircle className="text-green-500" size={20}/> Historique de mes visites</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">
                    <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Club</th><th className="px-6 py-4">Motif</th><th className="px-6 py-4">Score</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visits.length > 0 ? visits.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-gray-500 font-medium">{new Date(v.created_at).toLocaleDateString('fr-FR')}</td>
                        <td className="px-6 py-4 font-bold text-gray-800">{v.club_name}</td>
                        <td className="px-6 py-4 text-gray-600">{v.reason}</td>
                        <td className="px-6 py-4 font-bold text-interact-blue">{v.score} / 10</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="p-8 text-center text-gray-400">Aucun rapport n'a été rédigé pour le moment.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'securite' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden p-8 lg:p-12 text-center max-w-3xl mx-auto">
            <div className="mx-auto bg-gray-900 w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg">
              <Fingerprint className="text-white" size={40} />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-3">Enregistrer un Appareil</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">
              Associez le FaceID, TouchID ou Windows Hello de cet appareil à votre compte <b>{user.email}</b>. Vous pourrez vous connecter instantanément la prochaine fois.
            </p>
            <div className="border border-gray-200 rounded-2xl p-6 bg-gray-50 shadow-inner flex justify-center items-center">
              <div className="w-full max-w-sm">
                <p className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-widest">Zone Biométrique Sécurisée</p>
                
                {/* @ts-ignore : Ignore le bug de dictionnaire TypeScript de Corbado pour que Vercel accepte de déployer */}
                <CorbadoAuth
                  onLoggedIn={() =>
                    alert(
                     "FaceID activé ! Vous pourrez l'utiliser lors de votre prochaine connexion."
                   )
                 }
                />
                
              </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {showReportModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto transform transition-all">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur z-10">
              <h3 className="text-xl font-bold text-gray-800">Évaluer un Club</h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 w-8 h-8 rounded-full flex items-center justify-center transition-colors">&times;</button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Sélectionner le Club</label>
                <select value={selectedClub} onChange={(e) => setSelectedClub(e.target.value)} className="w-full border-gray-300 border p-3 rounded-xl bg-gray-50 outline-none focus:border-interact-blue focus:ring-1 focus:ring-interact-blue transition-all">
                  <option value="">-- Choisir un club --</option>
                  {zoneClubs.map((club, i) => <option key={i} value={club}>{club}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Raison de la visite</label>
                <select value={visitReason} onChange={(e) => setVisitReason(e.target.value)} className="w-full border-gray-300 border p-3 rounded-xl bg-gray-50 outline-none focus:border-interact-blue focus:ring-1 focus:ring-interact-blue transition-all">
                  <option value="Réunion Statutaire">Réunion Statutaire</option>
                  <option value="Élections du Bureau Exécutif">Élections du Bureau Exécutif</option>
                  <option value="Autre">Autre</option>
                </select>
                
                {visitReason === 'Autre' && (
                  <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                    <input type="text" placeholder="Veuillez préciser la raison..." value={specificReason} onChange={(e) => setSpecificReason(e.target.value)} className="w-full border-gray-300 border p-3 rounded-xl bg-white outline-none focus:border-interact-blue focus:ring-1 focus:ring-interact-blue transition-all"/>
                  </div>
                )}
              </div>

              <div className="pt-5 border-t border-gray-100">
                <h4 className="font-bold text-gray-800 mb-4 bg-gray-100 p-2 rounded-lg text-center text-sm tracking-wide">NOTATION (SUR 10)</h4>
                {[
                  { key: 'etat', label: 'État du club' }, { key: 'effectif', label: "Effectif" }, { key: 'organisation', label: "Organisation" }, { key: 'deroulement', label: "Déroulement" }, { key: 'professionnalisme', label: 'Professionnalisme' }
                ].map((critere, i) => (
                  <div key={i} className="flex justify-between items-center mb-4">
                    <label className="text-sm font-medium text-gray-600">{critere.label}</label>
                    <input type="number" min="0" max="10" value={(scores as any)[critere.key]} onChange={(e) => setScores({...scores, [critere.key]: e.target.value})} className="w-20 border-gray-300 border rounded-lg p-2 text-center font-bold text-interact-blue outline-none focus:border-interact-blue focus:ring-1 focus:ring-interact-blue shadow-sm" placeholder="/ 10" />
                  </div>
                ))}
              </div>
              
              <button onClick={handleSubmitReport} disabled={isSubmitting} className="w-full bg-interact-blue text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors flex justify-center items-center gap-2 mt-2 shadow-lg disabled:opacity-70">
                {isSubmitting ? <><Loader2 className="animate-spin" size={20} /> Enregistrement...</> : 'Soumettre le rapport'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}