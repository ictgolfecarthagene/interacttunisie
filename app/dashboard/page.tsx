'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

import { useCorbado, CorbadoAuth, CorbadoProvider } from '@corbado/react';
import { Trophy, Users, FileText, Plus, CheckCircle, Loader2, Fingerprint, Trash2, Building2, LogOut, MessageSquare, Clock, Map as MapIcon, MapPin, ChevronRight, Activity, Download } from 'lucide-react';
import jsPDF from 'jspdf';

const COMITE_NATIONAL_ROLES = ['Coordinateur National', 'Vice Coordinateur', 'Secrétaire National', 'Secrétaire National Adjoint', 'Trésorier', 'Chef de Protocole'];
const ZONES = ['Nord 1', 'Nord 2', 'Nord 3', 'Nord 4', 'Nord 5', 'Nord 6', 'Nord 7', 'Centre', 'Sud'];

export default function Dashboard() {
  const { isAuthenticated, user: corbadoUser, loading: corbadoLoading, logout: corbadoLogout } = useCorbado();
  const [user, setUser] = useState<any>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  
  const [allClubs, setAllClubs] = useState<any[]>([]); 
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]); 
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'users' | 'clubs' | 'securite' | 'my_club' | 'map'>('leaderboard');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('Toutes les zones');
  
  // Interactive Map State
  const [selectedMapZone, setSelectedMapZone] = useState<string | null>(null);
  const [selectedMapClub, setSelectedMapClub] = useState<string | null>(null);

  const [showReportModal, setShowReportModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedVisitForFeedback, setSelectedVisitForFeedback] = useState<any>(null);
  const [feedbackRating, setFeedbackRating] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  
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
  const [newUserClub, setNewUserClub] = useState('');

  const router = useRouter();
  const isComiteNational = user ? COMITE_NATIONAL_ROLES.includes(user.role) : false;

  const fetchVisitsAndLeaderboard = async (role: string, zone: string, club: string) => {
    let query = supabase.from('visits').select('*').order('created_at', { ascending: false });
    if (role === 'DRC') query = query.eq('zone', zone);
    if (role === 'Représentant Club') query = query.eq('club_name', club);
    
    const { data, error } = await query;
    if (data && !error) {
      setVisits(data);
      const clubStats: Record<string, any> = {};
      data.forEach(visit => {
        if (!clubStats[visit.club_name]) clubStats[visit.club_name] = { club_name: visit.club_name, zone: visit.zone, totalScore: 0, count: 0, last_visitor: visit.visitor_name };
        clubStats[visit.club_name].totalScore += Number(visit.score);
        clubStats[visit.club_name].count += 1;
      });
      const board = Object.values(clubStats).map((club: any) => ({ ...club, average: (club.totalScore / club.count).toFixed(2) })).sort((a: any, b: any) => b.average - a.average);
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
        await fetchAllClubs(); 
        await fetchVisitsAndLeaderboard(userData.role, userData.zone, userData.club);
        
        if (userData.role === 'Représentant Club') setActiveTab('my_club');
        
        if (COMITE_NATIONAL_ROLES.includes(userData.role)) {
          await fetchAllUsers();
        }
      }
      if (isMounted) { setIsAppLoading(false); clearTimeout(failsafeTimer); }
    }
    fetchDashboardData();
    return () => { isMounted = false; clearTimeout(failsafeTimer); };
  }, [isAuthenticated, corbadoUser, corbadoLoading, router]);

  // --- PDF GENERATOR FUNCTION ---
  const downloadReceipt = (visit: any) => {
    const doc = new jsPDF();
    
    // Attempt to add the Logo (must be named logo.png inside the public folder)
    const logo = new Image();
    logo.src = '/logo.png'; 
    try {
        doc.addImage(logo, 'PNG', 20, 20, 30, 30);
    } catch (e) {
        console.warn("Logo non trouvé ou non chargé à temps.");
    }

    // Header Formatting
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(0, 66, 137); // Interact Blue
    doc.text("RAPPORT OFFICIEL DE VISITE", 60, 35);
    
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("Interact Tunisie - Comité National", 60, 42);

    // Separator line
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 55, 190, 55);

    // Visit Details
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    
    doc.setFont("helvetica", "bold");
    doc.text("Club Évalué:", 20, 70);
    doc.setFont("helvetica", "normal");
    doc.text(visit.club_name, 60, 70);

    doc.setFont("helvetica", "bold");
    doc.text("Zone:", 20, 80);
    doc.setFont("helvetica", "normal");
    doc.text(visit.zone || 'N/A', 60, 80);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", 20, 90);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(visit.created_at).toLocaleDateString('fr-FR'), 60, 90);

    doc.setFont("helvetica", "bold");
    doc.text("Visiteur (DRC):", 20, 100);
    doc.setFont("helvetica", "normal");
    doc.text(visit.visitor_name, 60, 100);

    doc.setFont("helvetica", "bold");
    doc.text("Motif:", 20, 110);
    doc.setFont("helvetica", "normal");
    doc.text(visit.reason, 60, 110);

    // Score Box
    doc.setFillColor(240, 248, 255); // Light blue
    doc.rect(20, 130, 170, 30, 'F');
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 66, 137);
    doc.text(`Note Globale attribuée : ${visit.score} / 10`, 30, 148);

    // Save File
    doc.save(`Interact_Rapport_${visit.club_name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return alert("Veuillez remplir le nom et l'email.");
    setIsUpdating(true);
    
    const payload = { 
        full_name: newUserName, 
        email: newUserEmail.toLowerCase(), 
        role: newUserRole, 
        zone: ['DRC', 'Représentant Club'].includes(newUserRole) ? newUserZone : null,
        club: newUserRole === 'Représentant Club' ? newUserClub : null
    };

    const { error } = await supabase.from('users').insert(payload);
    if (!error) {
      setNewUserName(''); setNewUserEmail(''); setNewUserRole('PENDING'); setNewUserZone(''); setNewUserClub('');
      await fetchAllUsers(); alert("Membre pré-enregistré avec succès !");
    } else alert("Erreur de base de données. Cet email est peut-être déjà enregistré.");
    setIsUpdating(false);
  };

  const handleUpdateUser = async (userId: string, field: 'role' | 'zone' | 'club', value: string) => {
    setIsUpdating(true);
    const updateData: any = { [field]: value };
    if (field === 'role' && value !== 'DRC' && value !== 'Représentant Club') {
        updateData.zone = null;
        updateData.club = null;
    }
    const { error } = await supabase.from('users').update(updateData).eq('id', userId);
    if (!error) {
      setAllUsers(allUsers.map(u => u.id === userId ? { ...u, ...updateData } : u));
      if (userId === user.id) setUser({ ...user, ...updateData });
    } else alert("Erreur de mise à jour.");
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

  const handleAddClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClubName || !newClubZone) return alert("Veuillez remplir le nom et la zone.");
    setIsUpdating(true);
    const { error } = await supabase.from('clubs').insert({ name: newClubName, zone: newClubZone });
    if (!error) {
      setNewClubName(''); setNewClubZone(''); await fetchAllClubs(); alert("Club ajouté avec succès !");
    } else alert("Erreur lors de l'ajout.");
    setIsUpdating(false);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer ce rapport ?`)) return;
    setIsUpdating(true);
    const { error } = await supabase.from('visits').delete().eq('id', reportId);
    if (!error) fetchVisitsAndLeaderboard(user.role, user.zone, user.club);
    setIsUpdating(false);
  };

  const handleSubmitReport = async () => {
    if (!selectedClub) return alert("Veuillez sélectionner un club.");
    const allScores = Object.values(scores).map(Number);
    if (allScores.some(isNaN) || Object.values(scores).some(s => s === '')) return alert("Veuillez remplir toutes les notes.");

    setIsSubmitting(true);
    const averageScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const finalReason = visitReason === 'Autre' ? specificReason : visitReason;
    const currentClub = allClubs.find(c => c.name === selectedClub);
    const reportZone = currentClub ? currentClub.zone : (user?.zone || 'Zone Non Définie');

    const payload = {
      club_name: selectedClub, zone: reportZone, visitor_name: user?.full_name || 'Utilisateur', 
      reason: finalReason, score: Number(averageScore.toFixed(2)), date: new Date().toLocaleDateString('fr-FR')
    };

    const { error } = await supabase.from('visits').insert({
        club_name: payload.club_name, zone: payload.zone, visitor_name: payload.visitor_name, reason: payload.reason, score: payload.score
    });
    
    if (!error) {
       try { await fetch('/api/sheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch (e) { }
       alert("Rapport soumis avec succès ! 🎉");
       setShowReportModal(false); setSelectedClub(''); setSpecificReason('');
       setScores({ etat: '', effectif: '', organisation: '', deroulement: '', professionnalisme: '' });
       fetchVisitsAndLeaderboard(user.role, user.zone, user.club);
    } else { alert(`Erreur lors de la soumission.`); }
    setIsSubmitting(false);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackRating) return alert("Veuillez donner une note au DRC.");
    setIsSubmitting(true);
    
    const payload = {
        visit_id: selectedVisitForFeedback.id,
        club_name: user.club,
        drc_name: selectedVisitForFeedback.visitor_name,
        rating: Number(feedbackRating),
        feedback_text: feedbackText
    };

    const { error } = await supabase.from('drc_feedback').insert(payload);
    if (!error) {
        alert("Feedback envoyé au Comité National avec succès ! 🔒");
        setShowFeedbackModal(false); setFeedbackRating(''); setFeedbackText('');
    } else alert("Erreur lors de l'envoi.");
    setIsSubmitting(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut(); 
    if (isAuthenticated) await corbadoLogout(); 
    router.push('/');
  };

  const displayedLeaderboard = selectedZoneFilter === 'Toutes les zones' ? leaderboard : leaderboard.filter(c => c.zone === selectedZoneFilter);

  if (isAppLoading) return (<div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-interact-blue font-bold"><Loader2 className="animate-spin mb-4" size={40} /><p className="animate-pulse">Loading Interact Tunisie...</p></div>);
  if (!user) return (<div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-red-500 font-bold p-4 text-center"><p>Session expirée.</p><button onClick={() => router.push('/')} className="mt-6 px-6 py-3 bg-interact-blue text-white rounded-xl shadow-lg hover:bg-blue-700 transition">Retour à la connexion</button></div>);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 selection:bg-blue-100">
      
      <nav className="bg-white/90 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-interact-blue p-2 rounded-xl text-white shadow-inner hidden sm:flex"><Trophy size={20} /></div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Interact <span className="text-interact-blue">Tunisie</span></h1>
              <p className="text-xs text-gray-500 font-medium hidden sm:block">Portail de Coordination Nationale</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right hidden md:block">
              <p className="text-gray-900 font-bold leading-none">{user.full_name}</p>
              <p className="text-xs text-gray-500 font-medium mt-1">
                {user.role === 'DRC' ? `DRC ${user.zone}` : user.role === 'Représentant Club' ? `Rep. ${user.club}` : user.role}
              </p>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 bg-white text-gray-600 border border-gray-200 hover:bg-red-50 hover:text-red-600 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all"><LogOut size={16} className="hidden sm:block" /> Déconnexion</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* ======================= PENDING VIEW (STRICT LOCK) ======================= */}
        {user.role === 'PENDING' ? (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-10 md:p-16 text-center max-w-2xl mx-auto mt-10 animate-in fade-in zoom-in-95 duration-500">
            <div className="mx-auto bg-gray-50 w-24 h-24 rounded-full flex items-center justify-center mb-6 border-4 border-gray-100 shadow-inner">
              <Clock className="text-interact-blue" size={40} />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-4">Compte en attente</h2>
            <p className="text-gray-500 font-medium leading-relaxed mb-8">
              Bienvenue sur le portail Interact Tunisie, <b>{user.full_name}</b> !<br/><br/>
              Votre compte a été créé avec succès. Le Comité National doit maintenant vous assigner un rôle officiel (DRC, Représentant Club, etc.) pour débloquer votre accès au tableau de bord.
            </p>
            <button onClick={handleLogout} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold transition-colors">
              Se déconnecter pour le moment
            </button>
          </div>
        ) : (
          <>
            {/* ======================= TABS NAVIGATION ======================= */}
            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200 w-fit overflow-x-auto mx-auto sm:mx-0">
              {isComiteNational && (
                <>
                  <button onClick={() => setActiveTab('leaderboard')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'leaderboard' ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Trophy size={18} /> Classement</button>
                  <button onClick={() => setActiveTab('map')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'map' ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><MapIcon size={18} /> Carte Interactive</button>
                  <button onClick={() => setActiveTab('users')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'users' ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Users size={18} /> Accès & Rôles</button>
                  <button onClick={() => setActiveTab('clubs')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'clubs' ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Building2 size={18} /> Gestion Clubs</button>
                </>
              )}
              {user.role === 'DRC' && (
                <button onClick={() => setActiveTab('leaderboard')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'leaderboard' ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><FileText size={18} /> Ma Zone</button>
              )}
              {user.role === 'Représentant Club' && (
                <button onClick={() => setActiveTab('my_club')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'my_club' ? 'bg-gray-900 text-white shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Building2 size={18} /> Mon Club</button>
              )}
              <button onClick={() => setActiveTab('securite')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'securite' ? 'bg-interact-blue text-white shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Fingerprint size={18} /> FaceID</button>
            </div>

            {/* ======================= INTERACTIVE MAP ======================= */}
            {isComiteNational && activeTab === 'map' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-gradient-to-br from-gray-900 to-interact-blue rounded-3xl shadow-lg p-8 text-white relative overflow-hidden">
                    <MapIcon className="absolute -right-10 -bottom-10 opacity-10" size={250} />
                    <h2 className="text-3xl font-extrabold mb-2">Explorateur de Zones</h2>
                    <p className="text-blue-100 mb-8 max-w-xl">Sélectionnez une zone sur le territoire tunisien pour voir les clubs affectés, puis cliquez sur un club pour voir l'historique complet de ses visites.</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 relative z-10">
                        {ZONES.map(z => {
                            const clubsInZoneCount = allClubs.filter(c => c.zone === z).length;
                            return (
                                <button key={z} onClick={() => { setSelectedMapZone(z); setSelectedMapClub(null); }} 
                                        className={`p-4 rounded-2xl text-left transition-all duration-300 border-2 ${selectedMapZone === z ? 'bg-white text-interact-blue border-white shadow-xl transform scale-105' : 'bg-white/10 border-white/20 hover:bg-white/20 text-white'}`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <MapPin size={20} className={selectedMapZone === z ? 'text-interact-blue' : 'text-blue-200'} />
                                    </div>
                                    <h3 className="font-extrabold text-lg">{z}</h3>
                                    <p className={`text-xs font-medium mt-1 ${selectedMapZone === z ? 'text-gray-500' : 'text-blue-200'}`}>{clubsInZoneCount} Club(s)</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {selectedMapZone && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 animate-in slide-in-from-top-4 duration-300">
                        <h3 className="text-xl font-extrabold text-gray-900 mb-6 flex items-center gap-2">Clubs dans la zone : <span className="text-interact-blue">{selectedMapZone}</span></h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {allClubs.filter(c => c.zone === selectedMapZone).length > 0 ? (
                                allClubs.filter(c => c.zone === selectedMapZone).map(club => (
                                    <button key={club.id} onClick={() => setSelectedMapClub(club.name)} 
                                            className={`p-5 rounded-2xl border-2 flex justify-between items-center transition-all ${selectedMapClub === club.name ? 'border-interact-blue bg-blue-50' : 'border-gray-100 hover:border-gray-300 bg-white'}`}>
                                        <span className="font-bold text-gray-800 text-left">{club.name}</span>
                                        <ChevronRight size={18} className={selectedMapClub === club.name ? 'text-interact-blue' : 'text-gray-400'} />
                                    </button>
                                ))
                            ) : (
                                <p className="text-gray-400 font-medium col-span-full">Aucun club enregistré dans cette zone.</p>
                            )}
                        </div>
                    </div>
                )}

                {selectedMapClub && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 animate-in slide-in-from-top-4 duration-300">
                        <h3 className="text-xl font-extrabold text-gray-900 mb-6 flex items-center gap-2"><Activity className="text-green-500" /> Historique : {selectedMapClub}</h3>
                        <div className="space-y-4">
                            {visits.filter(v => v.club_name === selectedMapClub).length > 0 ? (
                                visits.filter(v => v.club_name === selectedMapClub).map(visit => (
                                    <div key={visit.id} className="p-5 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{new Date(visit.created_at).toLocaleDateString('fr-FR')}</p>
                                            <p className="font-bold text-gray-900">{visit.reason}</p>
                                            <p className="text-sm text-gray-600 mt-1">Visité par : <b>{visit.visitor_name}</b></p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="bg-white border-2 border-interact-blue/20 text-interact-blue font-black text-xl px-6 py-3 rounded-xl shadow-sm text-center">
                                                {visit.score} <span className="text-sm text-gray-400">/10</span>
                                            </div>
                                            <button onClick={() => downloadReceipt(visit)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 rounded-xl font-bold transition-colors flex items-center gap-2">
                                                <Download size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-400 font-medium">Aucune visite enregistrée pour ce club.</p>
                            )}
                        </div>
                    </div>
                )}
              </div>
            )}

            {/* ======================= REPRÉSENTANT CLUB VIEW ======================= */}
            {user.role === 'Représentant Club' && activeTab === 'my_club' && (
               <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden">
                   <div className="absolute left-0 top-0 bottom-0 w-3 bg-interact-blue"></div>
                   <div>
                     <h2 className="text-3xl font-extrabold text-gray-900 mb-2">{user.club}</h2>
                     <p className="text-gray-500 font-medium text-lg">Zone {user.zone} | Vous avez reçu <span className="text-interact-blue font-black">{visits.length}</span> visites officielles.</p>
                   </div>
                 </div>

                 <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 md:p-8 border-b border-gray-100 flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-xl text-interact-blue"><CheckCircle size={20} /></div>
                    <h3 className="text-xl font-bold text-gray-900">Visites du DRC</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50/50 text-gray-400 font-bold border-b border-gray-100 uppercase tracking-widest text-xs">
                        <tr><th className="px-8 py-5">Date</th><th className="px-8 py-5">Motif</th><th className="px-8 py-5">Visité par (DRC)</th><th className="px-8 py-5 text-right">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {visits.length > 0 ? visits.map(v => (
                          <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-8 py-5 text-gray-500 font-medium">{new Date(v.created_at).toLocaleDateString('fr-FR')}</td>
                            <td className="px-8 py-5 text-gray-800 font-medium">{v.reason}</td>
                            <td className="px-8 py-5 font-bold text-gray-900 text-base">{v.visitor_name}</td>
                            <td className="px-8 py-5 text-right flex justify-end gap-2">
                               <button onClick={() => downloadReceipt(v)} title="Télécharger le PDF" className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg font-bold transition-colors">
                                 <Download size={18} />
                               </button>
                               <button onClick={() => {setSelectedVisitForFeedback(v); setShowFeedbackModal(true);}} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors">
                                 <MessageSquare size={14} /> Évaluer le DRC
                               </button>
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan={4} className="p-16 text-center text-gray-400 font-medium">Aucune visite enregistrée pour le moment.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
               </div>
            )}

            {/* ======================= COMITE NATIONAL & DRC VIEWS ======================= */}
            {['leaderboard'].includes(activeTab) && !['Représentant Club'].includes(user.role) && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-gray-50 to-white gap-4">
                    <div>
                      <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3"><Trophy className="text-yellow-500" size={28} /> {isComiteNational ? 'Classement National' : `Zone ${user.zone}`}</h2>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <button onClick={() => setShowReportModal(true)} className="bg-gray-900 hover:bg-black text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all">
                        <Plus size={20} /> Nouveau Rapport
                      </button>
                      {isComiteNational && (
                        <select value={selectedZoneFilter} onChange={(e) => setSelectedZoneFilter(e.target.value)} className="border-gray-200 rounded-xl text-gray-700 py-3 px-4 border-2 outline-none font-bold focus:border-interact-blue focus:ring-4 cursor-pointer">
                          <option value="Toutes les zones">🌍 Toutes les zones</option>
                          {ZONES.map(zone => <option key={zone} value={zone}>📍 {zone}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50/50 text-gray-400 font-bold border-b uppercase tracking-widest text-xs">
                        <tr><th className="px-8 py-5">Rang</th><th className="px-8 py-5">Club Interact</th><th className="px-8 py-5">Zone</th><th className="px-8 py-5 text-center">Rapports</th><th className="px-8 py-5 text-right">Moyenne</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {displayedLeaderboard.length > 0 ? displayedLeaderboard.map((club, index) => (
                          <tr key={index} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-8 py-5 font-black text-gray-400">#{index + 1}</td>
                            <td className="px-8 py-5 font-bold text-gray-900">{club.club_name}</td>
                            <td className="px-8 py-5"><span className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold">{club.zone}</span></td>
                            <td className="px-8 py-5 text-center font-bold text-gray-500">{club.count}</td>
                            <td className="px-8 py-5 font-black text-interact-blue text-right text-xl">{club.average}</td>
                          </tr>
                        )) : (<tr><td colSpan={5} className="px-8 py-16 text-center text-gray-400">Aucun club évalué.</td></tr>)}
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
                      <thead className="bg-gray-50/50 text-gray-400 font-bold border-b uppercase tracking-widest text-xs">
                        <tr><th className="px-8 py-4">Date</th><th className="px-8 py-4">Club</th><th className="px-8 py-4">Motif</th><th className="px-8 py-4">Par</th><th className="px-8 py-4">Note</th><th className="px-8 py-4 text-right">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {visits.map((v) => (
                          <tr key={v.id} className="hover:bg-gray-50">
                            <td className="px-8 py-4 text-gray-500">{new Date(v.created_at).toLocaleDateString('fr-FR')}</td>
                            <td className="px-8 py-4 font-bold text-gray-900">{v.club_name}</td>
                            <td className="px-8 py-4 text-gray-600">{v.reason}</td>
                            <td className="px-8 py-4 font-medium text-gray-700">{v.visitor_name}</td>
                            <td className="px-8 py-4 font-black text-interact-blue">{v.score}</td>
                            <td className="px-8 py-4 text-right flex justify-end gap-2">
                              <button onClick={() => downloadReceipt(v)} title="Télécharger le PDF" className="text-gray-500 hover:text-interact-blue p-2 rounded-xl"><Download size={18} /></button>
                              <button onClick={() => handleDeleteReport(v.id)} disabled={isUpdating} className="text-gray-400 hover:text-red-600 p-2 rounded-xl"><Trash2 size={18} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ======================= USER MANAGEMENT (WITH FIX FOR REPRESENTATIVE CLUBS) ======================= */}
            {isComiteNational && activeTab === 'users' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-6 md:p-8">
                  <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3 mb-6"><div className="bg-green-100 p-2 rounded-xl text-green-600"><Plus size={20} /></div> Assigner un Compte</h2>
                  <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                    <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Prénom et Nom" className="lg:col-span-1 border-2 border-gray-200 rounded-xl p-3.5 focus:border-interact-blue" required />
                    <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Adresse email" className="lg:col-span-1 border-2 border-gray-200 rounded-xl p-3.5 focus:border-interact-blue" required />
                    
                    <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="lg:col-span-1 border-2 border-gray-200 rounded-xl p-3.5 focus:border-interact-blue bg-white" required>
                      <option value="PENDING">Sans Rôle</option>
                      <option value="DRC">DRC</option>
                      <option value="Représentant Club">Représentant Club</option>
                      <optgroup label="Comité National">{COMITE_NATIONAL_ROLES.map(role => <option key={role} value={role}>{role}</option>)}</optgroup>
                    </select>

                    {['DRC', 'Représentant Club'].includes(newUserRole) && (
                        <select value={newUserZone} onChange={e => setNewUserZone(e.target.value)} className="lg:col-span-1 border-2 border-interact-blue/30 rounded-xl p-3.5 focus:border-interact-blue bg-blue-50/50" required>
                          <option value="">Sélectionner Zone...</option>
                          {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                    )}

                    {newUserRole === 'Représentant Club' && newUserZone !== '' && (
                        <select value={newUserClub} onChange={e => setNewUserClub(e.target.value)} className="lg:col-span-1 border-2 border-interact-blue/30 rounded-xl p-3.5 focus:border-interact-blue bg-blue-50/50" required>
                          <option value="">Sélectionner Club...</option>
                          {allClubs.filter(c => c.zone === newUserZone).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    )}

                    <button type="submit" disabled={isUpdating} className="lg:col-span-1 bg-gray-900 hover:bg-black text-white font-bold py-3.5 px-6 rounded-xl shadow-lg ml-auto w-full">Ajouter</button>
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
                        <tr><th className="px-8 py-5">Nom</th><th className="px-8 py-5">Email</th><th className="px-8 py-5">Rôle</th><th className="px-8 py-5">Affectation</th><th className="px-8 py-5 text-right">Action</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {allUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-gray-50">
                            <td className="px-8 py-4 font-bold text-gray-900">{u.full_name}</td>
                            <td className="px-8 py-4 text-gray-500 font-medium">{u.email}</td>
                            <td className="px-8 py-4">
                                <select disabled={isUpdating} value={u.role || 'PENDING'} onChange={(e) => handleUpdateUser(u.id, 'role', e.target.value)} className="border-2 border-gray-200 rounded-xl p-2.5 bg-white w-full max-w-xs cursor-pointer">
                                  <option value="PENDING">En attente (Bloqué)</option>
                                  <option value="DRC">Directeur de Région (DRC)</option>
                                  <option value="Représentant Club">Représentant Club</option>
                                  <optgroup label="Comité National">{COMITE_NATIONAL_ROLES.map(role => <option key={role} value={role}>{role}</option>)}</optgroup>
                                </select>
                            </td>
                            <td className="px-8 py-4">
                               {u.role === 'DRC' && (
                                    <select disabled={isUpdating} value={u.zone || ''} onChange={(e) => handleUpdateUser(u.id, 'zone', e.target.value)} className="border-2 rounded-xl p-2.5 w-36 bg-white border-gray-200 cursor-pointer">
                                        <option value="">-- Zone --</option>
                                        {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                                    </select>
                               )}

                               {/* FIX FOR THE "AUCUN CLUB" DROPDOWN ISSUE */}
                               {u.role === 'Représentant Club' && (
                                    <select disabled={isUpdating} value={u.club || ''} onChange={(e) => handleUpdateUser(u.id, 'club', e.target.value)} className="border-2 rounded-xl p-2.5 w-full max-w-xs bg-white border-gray-200 cursor-pointer text-xs font-bold text-green-700">
                                        <option value="">-- Choisir Club... --</option>
                                        {allClubs.map(c => (
                                            <option key={c.id} value={c.name}>{c.name} ({c.zone})</option>
                                        ))}
                                    </select>
                               )}

                               {!['DRC', 'Représentant Club'].includes(u.role) && <span className="text-gray-400 text-xs">N/A</span>}
                            </td>
                            <td className="px-8 py-4 text-right">
                              <button onClick={() => handleDeleteUser(u.id, u.full_name)} disabled={isUpdating} className="text-red-500 border-2 border-red-100 px-4 py-2 rounded-xl text-xs font-bold">Retirer</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ======================= CLUB MANAGEMENT ======================= */}
            {isComiteNational && activeTab === 'clubs' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-6 md:p-8">
                  <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3 mb-6"><div className="bg-green-100 p-2 rounded-xl text-green-600"><Plus size={20} /></div> Ajouter un Club</h2>
                  <form onSubmit={handleAddClub} className="flex flex-col md:flex-row gap-4">
                    <input type="text" value={newClubName} onChange={e => setNewClubName(e.target.value)} placeholder="Nom du Club officiel" className="flex-1 border-2 border-gray-200 rounded-xl p-3.5 focus:border-interact-blue" required />
                    <select value={newClubZone} onChange={e => setNewClubZone(e.target.value)} className="w-full md:w-64 border-2 border-gray-200 rounded-xl p-3.5 focus:border-interact-blue bg-white" required>
                      <option value="">Sélectionner la Zone...</option>
                      {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                    <button type="submit" disabled={isUpdating} className="bg-gray-900 text-white font-bold py-3.5 px-8 rounded-xl">Ajouter</button>
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
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="px-8 py-5 font-bold text-gray-900 text-base">{c.name}</td>
                            <td className="px-8 py-5"><span className="bg-blue-50 text-interact-blue px-3 py-1.5 rounded-lg text-xs font-bold">{c.zone}</span></td>
                            <td className="px-8 py-5 text-right">
                              <button onClick={() => handleDeleteClub(c.id, c.name)} disabled={isUpdating} className="text-red-500 border-2 border-red-100 px-4 py-2 rounded-xl text-xs font-bold">Retirer</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            
            {/* Securite Tab */}
            {activeTab === 'securite' && (
              <div className="animate-in fade-in zoom-in-95 duration-500 bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-8 md:p-16 text-center max-w-2xl mx-auto mt-10">
                <div className="mx-auto bg-gradient-to-br from-gray-900 to-black w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-2xl transform rotate-3">
                  <Fingerprint className="text-white transform -rotate-3" size={48} />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Enregistrer un Appareil</h2>
                <div className="border-2 border-gray-100 rounded-3xl p-8 bg-gray-50 shadow-inner flex justify-center items-center">
                  <div className="w-full max-w-sm">
                    <p className="text-xs font-black text-gray-400 mb-6 uppercase tracking-widest">Zone Biométrique Sécurisée</p>
                    {/* @ts-ignore */}
                    <CorbadoProvider projectId={process.env.NEXT_PUBLIC_CORBADO_PROJECT_ID || "pro-6404309444468139215"}>
                      <CorbadoAuth onLoggedIn={() => alert('FaceID activé avec succès !')} />
                    </CorbadoProvider>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ======================= FEEDBACK MODAL ======================= */}
      {showFeedbackModal && selectedVisitForFeedback && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-extrabold text-gray-900 mb-2">Évaluer le DRC</h3>
            <p className="text-sm text-gray-500 mb-6">Ce feedback est <b className="text-gray-800">100% anonyme pour le DRC</b>. Seul le Comité National y a accès.</p>
            
            <div className="space-y-4">
               <div>
                 <label className="block text-sm font-bold text-gray-900 mb-2">Note sur le professionnalisme du DRC (/10)</label>
                 <input type="number" min="0" max="10" value={feedbackRating} onChange={(e) => setFeedbackRating(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl p-4 text-center font-black text-interact-blue text-2xl focus:border-interact-blue outline-none" placeholder="/ 10" />
               </div>
               <div>
                 <label className="block text-sm font-bold text-gray-900 mb-2">Commentaire libre (Optionnel)</label>
                 <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl p-4 focus:border-interact-blue outline-none text-sm h-32" placeholder="Comment s'est passée la visite ? Le DRC a-t-il été utile ?"></textarea>
               </div>
            </div>

            <div className="flex gap-3 mt-6">
               <button onClick={() => setShowFeedbackModal(false)} className="flex-1 bg-gray-100 text-gray-600 font-bold py-4 rounded-2xl">Annuler</button>
               <button onClick={handleSubmitFeedback} disabled={isSubmitting} className="flex-1 bg-gray-900 text-white font-bold py-4 rounded-2xl flex justify-center items-center gap-2">
                 {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Envoyer en secret"}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= REPORT MODAL ======================= */}
      {showReportModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur-md z-10">
              <h3 className="text-2xl font-extrabold text-gray-900">Évaluer un Club</h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-red-600 bg-gray-100 w-10 h-10 rounded-full flex items-center justify-center">&times;</button>
            </div>
            
            <div className="p-6 md:p-8 space-y-6">
              <select value={selectedClub} onChange={(e) => setSelectedClub(e.target.value)} className="w-full border-2 border-gray-200 p-4 rounded-xl bg-gray-50 outline-none focus:border-interact-blue font-bold text-gray-800">
                <option value="">-- Choisir un club --</option>
                {isComiteNational 
                  ? allClubs.map((club) => <option key={club.id} value={club.name}>{club.name} ({club.zone})</option>)
                  : allClubs.filter(c => c.zone === user?.zone).map((club) => <option key={club.id} value={club.name}>{club.name}</option>)
                }
              </select>
              
              <select value={visitReason} onChange={(e) => setVisitReason(e.target.value)} className="w-full border-2 border-gray-200 p-4 rounded-xl bg-gray-50 focus:border-interact-blue font-bold text-gray-800">
                <option value="Réunion Statutaire">Réunion Statutaire</option>
                <option value="Élections du Bureau Exécutif">Élections du Bureau Exécutif</option>
                <option value="Autre">Autre</option>
              </select>
              
              {visitReason === 'Autre' && <input type="text" placeholder="Précisez la raison..." value={specificReason} onChange={(e) => setSpecificReason(e.target.value)} className="w-full border-2 border-gray-200 p-4 rounded-xl bg-white focus:border-interact-blue font-medium"/>}

              <div className="pt-6 border-t border-gray-100">
                <h4 className="font-black text-gray-400 mb-6 bg-gray-50 p-3 rounded-xl text-center text-xs tracking-widest uppercase">Barème de Notation (sur 10)</h4>
                <div className="space-y-4">
                  {[{ key: 'etat', label: 'État général du club' }, { key: 'effectif', label: "Gestion de l'effectif" }, { key: 'organisation', label: "Organisation interne" }, { key: 'deroulement', label: "Déroulement de l'action" }, { key: 'professionnalisme', label: 'Professionnalisme' }].map((critere, i) => (
                    <div key={i} className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-2xl shadow-sm">
                      <label className="text-sm font-bold text-gray-700 ml-2">{critere.label}</label>
                      <input type="number" min="0" max="10" value={(scores as any)[critere.key]} onChange={(e) => setScores({...scores, [critere.key]: e.target.value})} className="w-24 border-2 border-gray-200 rounded-xl p-3 text-center font-black text-interact-blue text-lg focus:border-interact-blue" placeholder="/ 10" />
                    </div>
                  ))}
                </div>
              </div>
              
              <button onClick={handleSubmitReport} disabled={isSubmitting} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-bold flex justify-center items-center gap-3 mt-6 shadow-xl text-lg">
                {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : 'Soumettre le rapport officiel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
