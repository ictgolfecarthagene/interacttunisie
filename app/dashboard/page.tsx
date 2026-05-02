'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

import { useCorbado, CorbadoAuth, CorbadoProvider } from '@corbado/react';
import { Trophy, Users, FileText, Plus, CheckCircle, Loader2, Fingerprint, Trash2, Building2, LogOut, MessageSquare, Clock, Map as MapIcon, MapPin, ChevronRight, ChevronLeft, Activity, Download, Bell, Calendar as CalendarIcon, Star, Medal, ExternalLink } from 'lucide-react';
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
  const [drcLeaderboard, setDrcLeaderboard] = useState<any[]>([]);
  
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
  const [reportComment, setReportComment] = useState('');

  const [newClubName, setNewClubName] = useState('');
  const [newClubZone, setNewClubZone] = useState('');

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('PENDING');
  const [newUserZone, setNewUserZone] = useState('');
  const [newUserClub, setNewUserClub] = useState('');

  // --- CALENDAR STATES ---
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventPlace, setNewEventPlace] = useState('');
  const [newEventMapLink, setNewEventMapLink] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');

  const router = useRouter();
  const isComiteNational = user ? COMITE_NATIONAL_ROLES.includes(user.role) : false;

  const requestNotificationPermission = () => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  };

  const triggerBrowserNotification = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: '/logo.png' });
    }
  };

  const fetchData = async (userData: any) => {
    let query = supabase.from('visits').select('*').order('created_at', { ascending: false });
    if (userData.role === 'DRC') query = query.eq('zone', userData.zone);
    if (userData.role === 'Représentant Club') query = query.eq('club_name', userData.club);
    
    const { data: visitsData } = await query;
    if (visitsData) {
      setVisits(visitsData);
      const clubStats: Record<string, any> = {};
      const drcStats: Record<string, number> = {}; 

      visitsData.forEach(visit => {
        if (!clubStats[visit.club_name]) clubStats[visit.club_name] = { club_name: visit.club_name, zone: visit.zone, totalScore: 0, count: 0, last_visitor: visit.visitor_name };
        clubStats[visit.club_name].totalScore += Number(visit.score);
        clubStats[visit.club_name].count += 1;

        if (visit.visitor_name) {
          if (!drcStats[visit.visitor_name]) drcStats[visit.visitor_name] = 0;
          drcStats[visit.visitor_name] += 1;
        }
      });
      
      const board = Object.values(clubStats).map((club: any) => ({ ...club, average: (club.totalScore / club.count).toFixed(2) })).sort((a: any, b: any) => b.average - a.average);
      setLeaderboard(board);

      const drcBoard = Object.keys(drcStats).map(name => ({ name, points: drcStats[name] })).sort((a:any, b:any) => b.points - a.points);
      setDrcLeaderboard(drcBoard);
    }

    let notifQuery = supabase.from('notifications').select('*').order('created_at', { ascending: false });
    if (userData.role === 'DRC') notifQuery = notifQuery.eq('target_role', 'DRC').eq('target_zone', userData.zone);
    else if (userData.role === 'Représentant Club') notifQuery = notifQuery.eq('target_role', 'Représentant Club').eq('target_club', userData.club);
    else if (COMITE_NATIONAL_ROLES.includes(userData.role)) notifQuery = notifQuery.eq('target_role', 'Comité National');
    
    const { data: notifData } = await notifQuery;
    if (notifData) setNotifications(notifData);

    let eventQuery = supabase.from('club_events').select('*').order('event_date', { ascending: true });
    if (userData.role === 'DRC') eventQuery = eventQuery.eq('zone', userData.zone);
    if (userData.role === 'Représentant Club') eventQuery = eventQuery.eq('club_name', userData.club);
    const { data: eventsData } = await eventQuery;
    if (eventsData) setEvents(eventsData);

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
        requestNotificationPermission(); 

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

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('realtime-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
         const newNotif = payload.new as any;
         let isForMe = false;
         
         if (newNotif.target_role === 'Comité National' && COMITE_NATIONAL_ROLES.includes(user.role)) isForMe = true;
         if (newNotif.target_role === 'DRC' && user.role === 'DRC' && newNotif.target_zone === user.zone) isForMe = true;
         if (newNotif.target_role === 'Représentant Club' && user.role === 'Représentant Club' && newNotif.target_club === user.club) isForMe = true;

         if (isForMe) {
           setNotifications(prev => [newNotif, ...prev]);
           triggerBrowserNotification("Interact Tunisie", newNotif.message);
         }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); }
  }, [user]);

  const downloadReceipt = (visit: any) => {
    const doc = new jsPDF();
    const logo = new Image();
    logo.src = '/logo.png'; 
    try { doc.addImage(logo, 'PNG', 20, 15, 30, 30); } catch (e) { console.warn("Logo non chargé"); }

    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(0, 66, 137); 
    doc.text("RAPPORT OFFICIEL DE VISITE", 60, 30);
    doc.setFontSize(10); doc.setTextColor(150, 150, 150); doc.text("Interact Tunisie - Comité National", 60, 37);

    doc.setLineWidth(0.5); doc.setDrawColor(200, 200, 200); doc.line(20, 50, 190, 50);

    doc.setFontSize(12); doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold"); doc.text("Club Évalué:", 20, 65); doc.setFont("helvetica", "normal"); doc.text(visit.club_name, 60, 65);
    doc.setFont("helvetica", "bold"); doc.text("Zone:", 20, 75); doc.setFont("helvetica", "normal"); doc.text(visit.zone || 'N/A', 60, 75);
    doc.setFont("helvetica", "bold"); doc.text("Date:", 20, 85); doc.setFont("helvetica", "normal"); doc.text(new Date(visit.created_at).toLocaleDateString('fr-FR'), 60, 85);
    doc.setFont("helvetica", "bold"); doc.text("Visiteur (DRC):", 20, 95); doc.setFont("helvetica", "normal"); doc.text(visit.visitor_name, 60, 95);
    doc.setFont("helvetica", "bold"); doc.text("Motif:", 20, 105); doc.setFont("helvetica", "normal"); doc.text(visit.reason, 60, 105);

    doc.setFillColor(250, 250, 250); doc.rect(20, 115, 170, 55, 'F');
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("Détail de l'évaluation :", 25, 125);
    doc.setFont("helvetica", "normal");
    doc.text(`État général: ${visit.etat_score || 'N/A'}/10`, 25, 135);
    doc.text(`Gestion effectif: ${visit.effectif_score || 'N/A'}/10`, 25, 145);
    doc.text(`Organisation: ${visit.organisation_score || 'N/A'}/10`, 25, 155);
    doc.text(`Déroulement: ${visit.deroulement_score || 'N/A'}/10`, 110, 135);
    doc.text(`Professionnalisme: ${visit.professionnalisme_score || 'N/A'}/10`, 110, 145);

    doc.setFillColor(240, 248, 255); doc.rect(20, 180, 170, 20, 'F');
    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 66, 137);
    doc.text(`NOTE GLOBALE : ${visit.score} / 10`, 30, 193);

    doc.setFontSize(11); doc.setTextColor(50, 50, 50); doc.setFont("helvetica", "bold"); doc.text("Commentaire du DRC :", 20, 215); doc.setFont("helvetica", "italic");
    const splitComment = doc.splitTextToSize(visit.comments || "Aucun commentaire fourni par le DRC.", 170);
    doc.text(splitComment, 20, 225);

    doc.save(`Interact_Rapport_${visit.club_name.replace(/\s+/g, '_')}.pdf`);
  };

  const markNotificationAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleAddEvent = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newEventDate || !newEventPlace || !newEventDesc) return alert("Remplissez la date, le lieu et la description.");
      setIsUpdating(true);

      const payload = { 
          club_name: user.club, 
          zone: user.zone, 
          event_date: newEventDate, 
          place: newEventPlace, 
          google_maps_link: newEventMapLink,
          description: newEventDesc, 
          created_by: user.full_name 
      };
      
      const { error } = await supabase.from('club_events').insert(payload);
      
      if (!error) {
          await supabase.from('notifications').insert({ target_role: 'DRC', target_zone: user.zone, message: `📅 ${user.club} a programmé une nouvelle action le ${newEventDate}.` });
          setNewEventDate(''); setNewEventPlace(''); setNewEventMapLink(''); setNewEventDesc(''); 
          setShowEventModal(false);
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
      club_name: selectedClub, zone: reportZone, visitor_name: user?.full_name || 'Utilisateur', reason: finalReason, score: Number(averageScore.toFixed(2)), 
      etat_score: Number(scores.etat), effectif_score: Number(scores.effectif), organisation_score: Number(scores.organisation),
      deroulement_score: Number(scores.deroulement), professionnalisme_score: Number(scores.professionnalisme),
      comments: reportComment, date: new Date().toLocaleDateString('fr-FR')
    };

    const { error } = await supabase.from('visits').insert(payload);
    
    if (!error) {
       await supabase.from('notifications').insert({ target_role: 'Représentant Club', target_club: selectedClub, message: `📝 Une visite officielle a été enregistrée par le DRC ${user.full_name}. Veuillez laisser votre feedback.` });
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
    
    const payload = { visit_id: selectedVisitForFeedback.id, club_name: user.club, drc_name: selectedVisitForFeedback.visitor_name, rating: Number(feedbackRating), feedback_text: feedbackText };
    const { error } = await supabase.from('drc_feedback').insert(payload);
    
    if (!error) {
        await supabase.from('notifications').insert({ target_role: 'Comité National', message: `🔒 Nouveau feedback confidentiel soumis par ${user.club} pour le DRC ${selectedVisitForFeedback.visitor_name}.` });
        alert("Feedback envoyé au Comité National avec succès ! 🔒");
        setShowFeedbackModal(false); setFeedbackRating(''); setFeedbackText(''); fetchData(user);
    } else alert("Erreur lors de l'envoi.");
    setIsSubmitting(false);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newUserName || !newUserEmail) return alert("Veuillez remplir le nom et l'email."); setIsUpdating(true);
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
    setIsUpdating(true); await supabase.from('users').delete().eq('id', userId); setAllUsers(allUsers.filter(u => u.id !== userId)); setIsUpdating(false);
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

  // --- CALENDAR LOGIC ---
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  
  const nextMonth = () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));

  const daysInCurrentMonth = getDaysInMonth(currentMonthDate.getFullYear(), currentMonthDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentMonthDate.getFullYear(), currentMonthDate.getMonth());
  const startDayOffset = firstDay === 0 ? 6 : firstDay - 1; // Monday start
  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  const handleDayClick = (dayNumber: number) => {
      const formattedDate = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
      if (user.role === 'Représentant Club') {
          setNewEventDate(formattedDate);
          setShowEventModal(true);
      }
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
            {user.role !== 'PENDING' && (
                <div className="relative">
                    <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-gray-500 hover:text-interact-blue transition relative">
                        <Bell size={22} />
                        {unreadCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">{unreadCount}</span>}
                    </button>
                    {showNotifications && (
                        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-100 shadow-2xl rounded-2xl p-4 z-50 animate-in fade-in slide-in-from-top-4">
                            <div className="flex justify-between items-center mb-3 border-b pb-2">
                                <h4 className="font-extrabold text-gray-900">Notifications</h4>
                                <button onClick={requestNotificationPermission} title="Activer les notifications système" className="text-xs text-interact-blue hover:underline">Activer PC/Mobile</button>
                            </div>
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
              <button onClick={() => setActiveTab('securite')} className={`flex items-center whitespace-nowrap gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === 'securite' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}><Fingerprint size={18} /> FaceID</button>
            </div>

            {/* ======================= INTERACTIVE CALENDAR GRID ======================= */}
            {activeTab === 'calendar' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-6 md:p-8">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
                                <CalendarIcon className="text-interact-blue" size={28} />
                                {monthNames[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
                            </h2>
                            <div className="flex gap-2">
                                <button onClick={prevMonth} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl transition"><ChevronLeft size={20} /></button>
                                <button onClick={nextMonth} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl transition"><ChevronRight size={20} /></button>
                            </div>
                        </div>

                        {user.role === 'Représentant Club' && (
                            <p className="text-sm text-gray-500 mb-4 bg-blue-50 text-interact-blue p-3 rounded-xl font-medium inline-block border border-blue-100">
                                💡 Cliquez sur une date du calendrier pour annoncer une nouvelle action.
                            </p>
                        )}

                        <div className="grid grid-cols-7 gap-2">
                            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                                <div key={day} className="text-center font-bold text-gray-400 text-xs tracking-widest uppercase mb-2">{day}</div>
                            ))}
                            
                            {/* Empty offset slots */}
                            {Array.from({ length: startDayOffset }).map((_, i) => (
                                <div key={`empty-${i}`} className="bg-gray-50/50 rounded-xl border border-transparent"></div>
                            ))}

                            {/* Calendar Days */}
                            {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                                const dayNum = i + 1;
                                const formattedDateStr = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                const dayEvents = events.filter(e => e.event_date === formattedDateStr);
                                
                                return (
                                    <div 
                                        key={dayNum} 
                                        onClick={() => handleDayClick(dayNum)}
                                        className={`min-h-[100px] border border-gray-100 rounded-xl p-2 transition-all group ${user.role === 'Représentant Club' ? 'cursor-pointer hover:border-interact-blue hover:shadow-md bg-white' : 'bg-white'}`}
                                    >
                                        <div className="text-right text-sm font-bold text-gray-400 group-hover:text-interact-blue">{dayNum}</div>
                                        <div className="mt-1 space-y-1 overflow-y-auto max-h-[70px] custom-scrollbar">
                                            {dayEvents.map(ev => (
                                                <div key={ev.id} className="bg-blue-50 border border-blue-100 rounded-lg p-1.5 text-xs text-left" title={`${ev.club_name}: ${ev.description}`}>
                                                    <span className="font-black text-interact-blue block truncate">{ev.club_name}</span>
                                                    <span className="text-gray-700 truncate block">{ev.description}</span>
                                                    {ev.google_maps_link && (
                                                        <a href={ev.google_maps_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] flex items-center gap-1 text-blue-500 hover:underline mt-1 font-medium">
                                                            <MapPin size={10} /> Localisation
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ======================= FEEDBACKS TAB ======================= */}
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

            {/* ======================= COMITE NATIONAL & DRC VIEWS (LEADERBOARD) ======================= */}
            {['leaderboard'].includes(activeTab) && !['Représentant Club'].includes(user.role) && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {isComiteNational && (
                    <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl shadow-lg border border-gray-800 overflow-hidden text-white">
                      <div className="p-6 md:p-8 border-b border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <h2 className="text-2xl font-extrabold flex items-center gap-3"><Medal className="text-yellow-500" size={28} /> Classement des DRC (Confidentiel)</h2>
                          <p className="text-gray-400 text-sm mt-1">1 Visite Effectuée = 1 Point. Visible uniquement par le Comité National.</p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-white/5 text-gray-400 font-bold border-b border-white/10 uppercase tracking-widest text-xs">
                            <tr><th className="px-8 py-5">Rang</th><th className="px-8 py-5">Nom du DRC</th><th className="px-8 py-5 text-right">Points (Visites)</th></tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {drcLeaderboard.length > 0 ? drcLeaderboard.map((drc, index) => (
                              <tr key={index} className="hover:bg-white/5 transition-colors">
                                <td className="px-8 py-5 font-black text-gray-400">#{index + 1}</td>
                                <td className="px-8 py-5 font-bold">{drc.name}</td>
                                <td className="px-8 py-5 font-black text-interact-blue text-right text-xl">{drc.points} <span className="text-xs text-gray-500">pts</span></td>
                              </tr>
                            )) : (<tr><td colSpan={3} className="px-8 py-10 text-center text-gray-500">Aucun rapport DRC enregistré.</td></tr>)}
                          </tbody>
                        </table>
                      </div>
                    </div>
                )}

                <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-gray-50 to-white gap-4">
                    <div>
                      <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3"><Trophy className="text-yellow-500" size={28} /> {isComiteNational ? 'Classement National (Clubs)' : `Zone ${user.zone}`}</h2>
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

            {/* ======================= USER MANAGEMENT ======================= */}
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

      {/* ======================= ADD EVENT MODAL ======================= */}
      {showEventModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full">
            <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur-md z-10">
              <h3 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2"><CalendarIcon className="text-interact-blue" /> Annoncer une Action</h3>
              <button onClick={() => setShowEventModal(false)} className="text-gray-400 hover:text-red-600 bg-gray-100 w-10 h-10 rounded-full flex items-center justify-center">&times;</button>
            </div>
            <form onSubmit={handleAddEvent} className="p-6 md:p-8 space-y-4">
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Date de l'action</label>
                  <input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-interact-blue" required />
               </div>
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nom du lieu</label>
                  <input type="text" value={newEventPlace} onChange={e => setNewEventPlace(e.target.value)} placeholder="Ex: Maison de culture Hammam-Lif" className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-interact-blue" required />
               </div>
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Lien Google Maps (Optionnel)</label>
                  <input type="url" value={newEventMapLink} onChange={e => setNewEventMapLink(e.target.value)} placeholder="https://maps.app.goo.gl/..." className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-interact-blue" />
               </div>
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Motif / Description</label>
                  <input type="text" value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)} placeholder="Titre ou description courte de l'action" className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-interact-blue" required />
               </div>
               <button type="submit" disabled={isUpdating} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold flex justify-center items-center gap-3 mt-6 shadow-xl text-lg">
                  {isUpdating ? <Loader2 className="animate-spin" size={24} /> : 'Ajouter au Calendrier'}
               </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================= REPORT MODAL ======================= */}
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

    </div>
  );
}
