'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

import { useCorbado, CorbadoAuth, CorbadoProvider } from '@corbado/react';
import { Trophy, Users, FileText, Plus, CheckCircle, Loader2, Fingerprint, Trash2, Building2, LogOut, MessageSquare, Clock, Map as MapIcon, MapPin, ChevronRight, Activity, Download, Bell, Calendar as CalendarIcon, Star } from 'lucide-react';
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
  
  // New States for Advanced Features
  const [events, setEvents] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'users' | 'clubs' | 'securite' | 'my_club' | 'map' | 'calendar' | 'feedbacks'>('leaderboard');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('Toutes les zones');
  
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
  const [reportComment, setReportComment] = useState(''); // New DRC Comment

  const [newClubName, setNewClubName] = useState('');
  const [newClubZone, setNewClubZone] = useState('');

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('PENDING');
  const [newUserZone, setNewUserZone] = useState('');
  const [newUserClub, setNewUserClub] = useState('');

  // Calendar Event States
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventPlace, setNewEventPlace] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');

  const router = useRouter();
  const isComiteNational = user ? COMITE_NATIONAL_ROLES.includes(user.role) : false;

  const fetchData = async (userData: any) => {
    // 1. Fetch Visits & Leaderboard
    let query = supabase.from('visits').select('*').order('created_at', { ascending: false });
    if (userData.role === 'DRC') query = query.eq('zone', userData.zone);
    if (userData.role === 'Représentant Club') query = query.eq('club_name', userData.club);
    
    const { data: visitsData } = await query;
    if (visitsData) {
      setVisits(visitsData);
      const clubStats: Record<string, any> = {};
      visitsData.forEach(visit => {
        if (!clubStats[visit.club_name]) clubStats[visit.club_name] = { club_name: visit.club_name, zone: visit.zone, totalScore: 0, count: 0, last_visitor: visit.visitor_name };
        clubStats[visit.club_name].totalScore += Number(visit.score);
        clubStats[visit.club_name].count += 1;
      });
      const board = Object.values(clubStats).map((club: any) => ({ ...club, average: (club.totalScore / club.count).toFixed(2) })).sort((a: any, b: any) => b.average - a.average);
      setLeaderboard(board);
    }

    // 2. Fetch Notifications
    let notifQuery = supabase.from('notifications').select('*').order('created_at', { ascending: false });
    if (userData.role === 'DRC') notifQuery = notifQuery.eq('target_role', 'DRC').eq('target_zone', userData.zone);
    else if (userData.role === 'Représentant Club') notifQuery = notifQuery.eq('target_role', 'Représentant Club').eq('target_club', userData.club);
    else if (COMITE_NATIONAL_ROLES.includes(userData.role)) notifQuery = notifQuery.eq('target_role', 'Comité National');
    
    const { data: notifData } = await notifQuery;
    if (notifData) setNotifications(notifData);

    // 3. Fetch Events (Calendar)
    let eventQuery = supabase.from('club_events').select('*').order('event_date', { ascending: true });
    if (userData.role === 'DRC') eventQuery = eventQuery.eq('zone', userData.zone);
    if (userData.role === 'Représentant Club') eventQuery = eventQuery.eq('club_name', userData.club);
    const { data: eventsData } = await eventQuery;
    if (eventsData) setEvents(eventsData);

    // 4. Fetch Feedbacks (Only for Comité National)
    if (COMITE_NATIONAL_ROLES.includes(userData.role)) {
        const { data: fbData } = await supabase.from('drc_feedback').select('*').order('created_at', { ascending: false });
        if (fbData) setFeedbacks(fbData);
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
        await fetchData(userData);
        
        if (userData.role === 'Représentant Club') setActiveTab('my_club');
        if (COMITE_NATIONAL_ROLES.includes(userData.role)) await fetchAllUsers();
      }
      if (isMounted) { setIsAppLoading(false); clearTimeout(failsafeTimer); }
    }
    fetchDashboardData();
    return () => { isMounted = false; clearTimeout(failsafeTimer); };
  }, [isAuthenticated, corbadoUser, corbadoLoading, router]);

  // --- PDF GENERATOR FUNCTION (UPGRADED) ---
  const downloadReceipt = (visit: any) => {
    const doc = new jsPDF();
    
    // Attempt to add the Logo
    const logo = new Image();
    logo.src = '/logo.png'; 
    try { doc.addImage(logo, 'PNG', 20, 15, 30, 30); } catch (e) { console.warn("Logo non chargé"); }

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(0, 66, 137); 
    doc.text("RAPPORT OFFICIEL DE VISITE", 60, 30);
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("Interact Tunisie - Comité National", 60, 37);

    // Separator
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 50, 190, 50);

    // Visit Details
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold"); doc.text("Club Évalué:", 20, 65); doc.setFont("helvetica", "normal"); doc.text(visit.club_name, 60, 65);
    doc.setFont("helvetica", "bold"); doc.text("Zone:", 20, 75); doc.setFont("helvetica", "normal"); doc.text(visit.zone || 'N/A', 60, 75);
    doc.setFont("helvetica", "bold"); doc.text("Date:", 20, 85); doc.setFont("helvetica", "normal"); doc.text(new Date(visit.created_at).toLocaleDateString('fr-FR'), 60, 85);
    doc.setFont("helvetica", "bold"); doc.text("Visiteur (DRC):", 20, 95); doc.setFont("helvetica", "normal"); doc.text(visit.visitor_name, 60, 95);
    doc.setFont("helvetica", "bold"); doc.text("Motif:", 20, 105); doc.setFont("helvetica", "normal"); doc.text(visit.reason, 60, 105);

    // Detailed Marks Box
    doc.setFillColor(250, 250, 250);
    doc.rect(20, 115, 170, 55, 'F');
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold"); doc.text("Détail de l'évaluation :", 25, 125);
    doc.setFont("helvetica", "normal");
    doc.text(`État général: ${visit.etat_score || 'N/A'}/10`, 25, 135);
    doc.text(`Gestion effectif: ${visit.effectif_score || 'N/A'}/10`, 25, 145);
    doc.text(`Organisation: ${visit.organisation_score || 'N/A'}/10`, 25, 155);
    doc.text(`Déroulement: ${visit.deroulement_score || 'N/A'}/10`, 110, 135);
    doc.text(`Professionnalisme: ${visit.professionnalisme_score || 'N/A'}/10`, 110, 145);

    // Total Score Box
    doc.setFillColor(240, 248, 255); 
    doc.rect(20, 180, 170, 20, 'F');
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 66, 137);
    doc.text(`NOTE GLOBALE : ${visit.score} / 10`, 30, 193);

    // Comments
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.text("Commentaire du DRC :", 20, 215);
    doc.setFont("helvetica", "italic");
    
    const splitComment = doc.splitTextToSize(visit.comments || "Aucun commentaire fourni par le DRC.", 170);
    doc.text(splitComment, 20, 225);

    // Save File
    doc.save(`Interact_Rapport_${visit.club_name.replace(/\s+/g, '_')}.pdf`);
  };

  const markNotificationAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleAddEvent = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newEventDate || !newEventPlace || !newEventDesc) return alert("Remplissez tous les champs.");
      setIsUpdating(true);

      const payload = {
          club_name: user.club,
          zone: user.zone,
          event_date: newEventDate,
          place: newEventPlace,
          description: newEventDesc,
          created_by: user.full_name
      };

      const { error } = await supabase.from('club_events').insert(payload);
      if (!error) {
          // Notify DRC
          await supabase.from('notifications').insert({
              target_role: 'DRC', target_zone: user.zone,
              message: `📅 Nouvel événement ajouté par ${user.club}.`
          });
          setNewEventDate(''); setNewEventPlace(''); setNewEventDesc('');
          fetchData(user);
          alert("Événement ajouté au calendrier !");
      }
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
      reason: finalReason, score: Number(averageScore.toFixed(2)), 
      etat_score: Number(scores.etat), effectif_score: Number(scores.effectif), organisation_score: Number(scores.organisation),
      deroulement_score: Number(scores.deroulement), professionnalisme_score: Number(scores.professionnalisme),
      comments: reportComment, date: new Date().toLocaleDateString('fr-FR')
    };

    const { error } = await supabase.from('visits').insert(payload);
    
    if (!error) {
       // Notify the Club Representative
       await supabase.from('notifications').insert({
            target_role: 'Représentant Club', target_club: selectedClub,
            message: `📝 Une visite officielle a été enregistrée par le DRC ${user.full_name}. Veuillez laisser votre feedback.`
       });

       alert("Rapport soumis avec succès ! 🎉");
       setShowReportModal(false); setSelectedClub(''); setSpecificReason(''); setReportComment('');
       setScores({ etat: '', effectif: '', organisation: '', deroulement: '', professionnalisme: '' });
       fetchData(user);
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
        // Notify Comite National
        await supabase.from('notifications').insert({
            target_role: 'Comité National',
            message: `🔒 Nouveau feedback confidentiel soumis par ${user.club} pour le DRC ${selectedVisitForFeedback.visitor_name}.`
        });

        alert("Feedback envoyé au Comité National avec succès ! 🔒");
        setShowFeedbackModal(false); setFeedbackRating(''); setFeedbackText('');
        fetchData(user);
    } else alert("Erreur lors de l'envoi.");
    setIsSubmitting(false);
  };

  // ... (Keep handleAddUser, handleUpdateUser, handleDeleteUser, handleAddClub, handleDeleteClub from previous code exactly the same, omitted here for brevity to focus on new renders but KEEP them in your file) ...
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return alert("Veuillez remplir le nom et l'email.");
    setIsUpdating(true);
    const payload = { full_name: newUserName, email: newUserEmail.toLowerCase(), role: newUserRole, zone: ['DRC', 'Représentant Club'].includes(newUserRole) ? newUserZone : null, club: newUserRole === 'Représentant Club' ? newUserClub : null };
    const { error } = await supabase.from('users').insert(payload);
    if (!error) { setNewUserName(''); setNewUserEmail(''); setNewUserRole('PENDING'); setNewUserZone(''); setNewUserClub(''); await fetchAllUsers(); alert("Membre pré-enregistré !"); }
    setIsUpdating(false);
  };
  const handleUpdateUser = async (userId: string, field: 'role' | 'zone' | 'club', value: string) => {
    setIsUpdating(true);
    const updateData: any = { [field]: value };
    if (field === 'role' && value !== 'DRC' && value !== 'Représentant Club') { updateData.zone = null; updateData.club = null; }
    const { error } = await supabase.from('users').update(updateData).eq('id', userId);
    if (!error) { setAllUsers(allUsers.map(u => u.id === userId ? { ...u, ...updateData } : u)); if (userId === user.id) setUser({ ...user, ...updateData }); }
    setIsUpdating(false);
  };
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Voulez-vous supprimer l'accès de ${userName}?`)) return;
    setIsUpdating(true); await supabase.from('users').delete().eq('id', userId);
    setAllUsers(allUsers.filter(u => u.id !== userId));
    setIsUpdating(false);
  };
  const handleAddClub = async (e: React.FormEvent) => {
    e.preventDefault(); setIsUpdating(true);
    const { error } = await supabase.from('clubs').insert({ name: newClubName, zone: newClubZone });
    if (!error) { setNewClubName(''); setNewClubZone(''); await fetchAllClubs(); alert("Club ajouté !"); }
    setIsUpdating(false);
  };
  const handleDeleteClub = async (clubId: string, clubName: string) => {
    if (!window.confirm(`Voulez-vous supprimer le club ${clubName}?`)) return;
    setIsUpdating(true); await supabase.from('clubs').delete().eq('id', clubId); await fetchAllClubs(); setIsUpdating(false);
  };
  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm(`Voulez-vous supprimer ce rapport?`)) return;
    setIsUpdating(true); await supabase.from('visits').delete().eq('id', reportId); fetchData(user); setIsUpdating(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut(); 
    if (isAuthenticated) await corbadoLogout(); 
    router.push('/');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const displayedLeaderboard = selectedZoneFilter === 'Toutes les zones' ? leaderboard : leaderboard.filter(c => c.zone === selectedZoneFilter);

  if (isAppLoading) return (<div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-interact-blue font-bold"><Loader2 className="animate-spin mb-4" size={40} /><p className="animate-pulse">Loading Interact Tunisie...</p></div>);
  if (!user) return (<div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-red-500 font-bold p-4 text-center"><p>Session expirée.</p><button onClick={() => router.push('/')} className="mt-6 px-6 py-3 bg-interact-blue text-white rounded-xl shadow-lg hover:bg-blue-700 transition">Retour à la connexion</button></div>);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 selection:bg-blue-100">
      
      <nav className="bg-white/90 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center relative">
          <div className="flex items-center gap-4">
            <div className="bg-interact-blue p-2 rounded-xl text-white shadow-inner hidden sm:flex"><Trophy size={20} /></div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Interact <span className="text-interact-blue">Tunisie</span></h1>
              <p className="text-xs text-gray-500 font-medium hidden sm:block">Portail de Coordination Nationale</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            {/* NOTIFICATION BELL */}
            {user.role !== 'PENDING' && (
                <div className="relative">
                    <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-gray-500 hover:text-interact-blue transition relative">
                        <Bell size={22} />
                        {unreadCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">{unreadCount}</span>}
                    </button>
                    {showNotifications && (
                        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-100 shadow-2xl rounded-2xl p-4 z-50 animate-in fade-in slide-in-from-top-4">
                            <h4 className="font-extrabold text-gray-900 mb-3 border-b pb-2">Notifications</h4>
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {notifications.length > 0 ? notifications.map(n => (
                                    <div key={n.id} onClick={() => markNotificationAsRead(n.id)} className={`p-3 rounded-xl text-sm cursor-pointer transition ${n.is_read ? 'bg-gray-50 text-gray-500' : 'bg-blue-50 text-interact-blue font-bold border border-blue-100'}`}>
                                        {n.message}
                                    </div>
                                )) : <p className="text-xs text-gray-400 text-center py-4">Aucune notification.</p>}
                            </div>
                        </div>
                    )}
                </div>
            )}

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
        
        {user.role === 'PENDING' ? (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-10 md:p-16 text-center max-w-2xl mx-auto mt-10 animate-in fade-in zoom-in-95 duration-500">
            <div className="mx-auto bg-gray-50 w-24 h-24 rounded-full flex items-center justify-center mb-6 border-4 border-gray-100 shadow-inner">
              <Clock className="text-interact-blue" size={40} />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-4">Compte en attente</h2>
            <p className="text-gray-500 font-medium leading-relaxed mb-8">Bienvenue sur le portail Interact Tunisie, <b>{user.full_name}</b> !<br/><br/>Le Comité National doit maintenant vous assigner un rôle officiel pour débloquer votre accès au tableau de bord.</p>
          </div>
        ) : (
          <>
            {/* TABS NAVIGATION */}
            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200 w-fit overflow-x-auto mx-auto sm:mx-0">
              {isComiteNational && (
                <>
                  <button onClick={() => setActiveTab('leaderboard')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'leaderboard' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Trophy size={18} /> Classement</button>
                  <button onClick={() => setActiveTab('feedbacks')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'feedbacks' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Star size={18} /> Feedbacks DRC</button>
                  <button onClick={() => setActiveTab('map')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'map' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><MapIcon size={18} /> Explorateur</button>
                  <button onClick={() => setActiveTab('users')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'users' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Users size={18} /> Accès</button>
                  <button onClick={() => setActiveTab('clubs')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'clubs' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Building2 size={18} /> Clubs</button>
                </>
              )}
              {user.role === 'DRC' && (
                <button onClick={() => setActiveTab('leaderboard')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'leaderboard' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><FileText size={18} /> Ma Zone</button>
              )}
              {user.role === 'Représentant Club' && (
                <button onClick={() => setActiveTab('my_club')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'my_club' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Building2 size={18} /> Mon Club</button>
              )}
              <button onClick={() => setActiveTab('calendar')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'calendar' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><CalendarIcon size={18} /> Calendrier</button>
            </div>

            {/* ======================= CALENDAR TAB ======================= */}
            {activeTab === 'calendar' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    {user.role === 'Représentant Club' && (
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-6 md:p-8">
                            <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3 mb-6"><div className="bg-blue-100 p-2 rounded-xl text-interact-blue"><CalendarIcon size={20} /></div> Annoncer une Action</h2>
                            <form onSubmit={handleAddEvent} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="border-2 border-gray-200 rounded-xl p-3 focus:border-interact-blue" required />
                                <input type="text" value={newEventPlace} onChange={e => setNewEventPlace(e.target.value)} placeholder="Lieu (Ex: Maison de culture)" className="border-2 border-gray-200 rounded-xl p-3 focus:border-interact-blue" required />
                                <input type="text" value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)} placeholder="Titre / Description de l'action" className="md:col-span-2 border-2 border-gray-200 rounded-xl p-3 focus:border-interact-blue" required />
                                <button type="submit" disabled={isUpdating} className="md:col-span-4 bg-gray-900 hover:bg-black text-white font-bold py-3.5 px-6 rounded-xl shadow-lg mt-2">Ajouter au Calendrier</button>
                            </form>
                        </div>
                    )}

                    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-6 md:p-8">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">Événements à venir ({isComiteNational ? 'National' : user.role === 'DRC' ? `Zone ${user.zone}` : user.club})</h3>
                        <div className="space-y-4">
                            {events.length > 0 ? events.map(ev => (
                                <div key={ev.id} className="flex flex-col md:flex-row gap-4 p-5 bg-gray-50 border border-gray-100 rounded-2xl items-start md:items-center">
                                    <div className="bg-white border-2 border-interact-blue/20 text-interact-blue font-black px-4 py-3 rounded-xl text-center min-w-[100px]">
                                        {new Date(ev.event_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 text-lg">{ev.description}</h4>
                                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-2"><MapPin size={14}/> {ev.place}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-xs font-bold block mb-1">{ev.club_name}</span>
                                        <span className="text-xs text-gray-400">Zone {ev.zone}</span>
                                    </div>
                                </div>
                            )) : <p className="text-gray-400 text-center py-10">Aucun événement planifié.</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* ======================= FEEDBACKS TAB (COMITE NATIONAL ONLY) ======================= */}
            {isComiteNational && activeTab === 'feedbacks' && (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                  <div className="p-6 md:p-8 border-b border-gray-100 flex items-center gap-3 bg-red-50/30">
                    <div className="bg-red-100 p-2 rounded-xl text-red-600"><Star size={20} /></div>
                    <h2 className="text-2xl font-extrabold text-gray-900">Retours Confidentiels sur les DRC</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50/50 text-gray-400 font-bold border-b uppercase tracking-widest text-xs">
                        <tr><th className="px-8 py-5">Date</th><th className="px-8 py-5">Évalué par (Club)</th><th className="px-8 py-5">DRC Concerné</th><th className="px-8 py-5 text-center">Note / 10</th><th className="px-8 py-5">Commentaire Secret</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {feedbacks.length > 0 ? feedbacks.map((fb) => (
                          <tr key={fb.id} className="hover:bg-gray-50">
                            <td className="px-8 py-5 text-gray-500">{new Date(fb.created_at).toLocaleDateString('fr-FR')}</td>
                            <td className="px-8 py-5 font-bold text-gray-900">{fb.club_name}</td>
                            <td className="px-8 py-5 text-gray-800 font-medium">{fb.drc_name}</td>
                            <td className="px-8 py-5 text-center font-black text-red-500 text-lg">{fb.rating}</td>
                            <td className="px-8 py-5 text-gray-600 italic max-w-xs truncate" title={fb.feedback_text}>{fb.feedback_text || "Aucun commentaire"}</td>
                          </tr>
                        )) : <tr><td colSpan={5} className="px-8 py-16 text-center text-gray-400">Aucun feedback enregistré.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
            )}

            {/* OMITTED HTML FOR BREVITY: The rest of the tabs (Leaderboard, Users, Clubs, Rep View, Interactive Map) remain exactly the same as the previous response. Paste them here. */}
            
            {/* ... Keep Interactive Map View HTML ... */}
            {/* ... Keep Représentant Club HTML ... */}
            {/* ... Keep Leaderboard HTML ... */}
            {/* ... Keep Users HTML ... */}
            {/* ... Keep Clubs HTML ... */}

          </>
        )}
      </main>

      {/* ======================= REPORT MODAL (UPGRADED WITH COMMENTS) ======================= */}
      {showReportModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur-md z-10">
              <h3 className="text-2xl font-extrabold text-gray-900">Évaluer un Club</h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-red-600 bg-gray-100 w-10 h-10 rounded-full flex items-center justify-center">&times;</button>
            </div>
            
            <div className="p-6 md:p-8 space-y-6">
              <select value={selectedClub} onChange={(e) => setSelectedClub(e.target.value)} className="w-full border-2 border-gray-200 p-4 rounded-xl bg-gray-50 focus:border-interact-blue font-bold text-gray-800">
                <option value="">-- Choisir un club --</option>
                {isComiteNational ? allClubs.map((club) => <option key={club.id} value={club.name}>{club.name} ({club.zone})</option>) : allClubs.filter(c => c.zone === user?.zone).map((club) => <option key={club.id} value={club.name}>{club.name}</option>)}
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
                  {[{ key: 'etat', label: 'État général' }, { key: 'effectif', label: "Gestion effectif" }, { key: 'organisation', label: "Organisation" }, { key: 'deroulement', label: "Déroulement" }, { key: 'professionnalisme', label: 'Professionnalisme' }].map((critere, i) => (
                    <div key={i} className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-2xl shadow-sm">
                      <label className="text-sm font-bold text-gray-700 ml-2">{critere.label}</label>
                      <input type="number" min="0" max="10" value={(scores as any)[critere.key]} onChange={(e) => setScores({...scores, [critere.key]: e.target.value})} className="w-24 border-2 border-gray-200 rounded-xl p-3 text-center font-black text-interact-blue focus:border-interact-blue" placeholder="/ 10" />
                    </div>
                  ))}
                </div>
              </div>

              {/* NEW COMMENT FIELD FOR THE PDF */}
              <div className="pt-4 border-t border-gray-100">
                 <label className="block text-sm font-bold text-gray-900 mb-2">Commentaire global du DRC (Sera visible sur le PDF)</label>
                 <textarea value={reportComment} onChange={(e) => setReportComment(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl p-4 focus:border-interact-blue outline-none text-sm h-24" placeholder="Points forts, points faibles..."></textarea>
              </div>
              
              <button onClick={handleSubmitReport} disabled={isSubmitting} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-bold flex justify-center items-center gap-3 mt-6 shadow-xl text-lg">
                {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : 'Soumettre le rapport officiel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KEEP FEEDBACK MODAL HTML HERE */}

    </div>
  );
}
