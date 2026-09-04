import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, 
  addDoc, updateDoc, deleteDoc 
} from 'firebase/firestore';
import { 
  Wallet, TrendingUp, TrendingDown, Users, 
  CheckCircle, Clock, XCircle, FileText, 
  Upload, Copy, Download, UserPlus, Trash2, 
  History, Calendar, CreditCard, Lock, LogOut, 
  Key, AlertTriangle, ShieldPlus, PlusCircle, Building, ShieldCheck
} from 'lucide-react';

// --- SETUP FIREBASE ---
// --- 1. SETUP FIREBASE ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);
// const db = getFirestore(app);
// const appId = 'kas-kelas-app';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_SETTINGS = { iuranBulanan: 20000, bankName: 'BCA', bankAccount: '1234567890', bankOwner: 'Bendahara Kelas' };
const SUPER_ADMIN_PIN = "admin123";

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const fileInputRef = useRef(null);

  const [currentAuth, setCurrentAuth] = useState({
    isLoggedIn: false,
    role: null, // 'superadmin' | 'admin' | 'siswa'
    classId: null,
    studentId: null
  });
  const [loginTab, setLoginTab] = useState('siswa');
  const [loginClassId, setLoginClassId] = useState('');

  const [allClasses, setAllClasses] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [allSettings, setAllSettings] = useState([]);

  const [activeTab, setActiveTab] = useState('dashboard');
  
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
        if (isMounted) showToast("Gagal melakukan autentikasi", "error");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      if (isMounted) setUser(usr);
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const basePath = ['artifacts', appId, 'public', 'data'];
    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= 5) setIsLoading(false);
    };

    const unsubClasses = onSnapshot(collection(db, ...basePath, 'classes'), 
      (snap) => { setAllClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); checkLoaded(); },
      (err) => console.error(err)
    );
    const unsubStudents = onSnapshot(collection(db, ...basePath, 'students'), 
      (snap) => { setAllStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); checkLoaded(); },
      (err) => console.error(err)
    );
    const unsubPayments = onSnapshot(collection(db, ...basePath, 'payments'), 
      (snap) => { setAllPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); checkLoaded(); },
      (err) => console.error(err)
    );
    const unsubExpenses = onSnapshot(collection(db, ...basePath, 'expenses'), 
      (snap) => { setAllExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); checkLoaded(); },
      (err) => console.error(err)
    );
    const unsubSettings = onSnapshot(collection(db, ...basePath, 'settings'), 
      (snap) => { setAllSettings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); checkLoaded(); },
      (err) => console.error(err)
    );

    return () => { unsubClasses(); unsubStudents(); unsubPayments(); unsubExpenses(); unsubSettings(); };
  }, [user]);

  const activeClass = useMemo(() => allClasses.find(c => c.id === currentAuth.classId) || null, [allClasses, currentAuth.classId]);
  const students = useMemo(() => allStudents.filter(s => s.classId === currentAuth.classId), [allStudents, currentAuth.classId]);
  const payments = useMemo(() => allPayments.filter(p => p.classId === currentAuth.classId), [allPayments, currentAuth.classId]);
  const expenses = useMemo(() => allExpenses.filter(e => e.classId === currentAuth.classId), [allExpenses, currentAuth.classId]);
  const settings = useMemo(() => allSettings.find(s => s.id === currentAuth.classId) || DEFAULT_SETTINGS, [allSettings, currentAuth.classId]);
  const currentStudent = useMemo(() => students.find(s => s.id === currentAuth.studentId) || null, [students, currentAuth.studentId]);

  const stats = useMemo(() => {
    if (currentAuth.role === 'superadmin') {
      return { totalKelas: allClasses.length, totalSiswaGlobal: allStudents.length };
    }
    const totalPemasukan = payments
      .filter(p => p.status === 'lunas' && p.year === CURRENT_YEAR)
      .reduce((sum, p) => sum + Number(p.amount), 0);
      
    const totalPengeluaran = expenses
      .filter(e => e.date && new Date(e.date).getFullYear() === CURRENT_YEAR)
      .reduce((sum, e) => sum + Number(e.amount), 0);
      
    const currentMonth = new Date().getMonth();
    
    let tunggakanCount = 0;
    students.forEach(student => {
      const hasPaid = payments.some(p => p.studentId === student.id && p.month === currentMonth && p.year === CURRENT_YEAR && p.status === 'lunas');
      if (!hasPaid) tunggakanCount++;
    });

    return { kasSaatIni: totalPemasukan - totalPengeluaran, totalPemasukan, totalPengeluaran, tunggakanCount };
  }, [payments, expenses, students, currentAuth.role, allClasses, allStudents]);

  const recentActivities = useMemo(() => {
    const p = payments.map(pay => ({
      ...pay, type: 'payment', sortDate: new Date(pay.timestamp || Date.now()).getTime(),
      displayDate: new Date(pay.timestamp || Date.now()).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})
    }));
    const e = expenses.map(exp => ({
      ...exp, type: 'expense', sortDate: new Date(exp.timestamp || exp.date || Date.now()).getTime(),
      displayDate: new Date(exp.date || exp.timestamp).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})
    }));
    return [...p, ...e].sort((a, b) => b.sortDate - a.sortDate).slice(0, 10);
  }, [payments, expenses]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  const confirmAction = (message, onConfirm) => setConfirmDialog({ message, onConfirm });
  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  const getStudentName = (id) => students.find(s => s.id === id)?.name || 'Siswa Dihapus';

  const copyToClipboard = (text) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast('Berhasil disalin!')).catch(() => showToast('Gagal', 'error'));
    } else {
      const textArea = document.createElement("textarea"); textArea.value = text;
      document.body.appendChild(textArea); textArea.select();
      try { document.execCommand('copy'); showToast('Berhasil disalin!'); } catch (err) { showToast('Gagal', 'error'); }
      document.body.removeChild(textArea);
    }
  };

  const handleLoginSuperAdmin = (e) => {
    e.preventDefault();
    if (e.target.pin.value === SUPER_ADMIN_PIN) {
      setCurrentAuth({ isLoggedIn: true, role: 'superadmin', classId: null, studentId: null });
      setActiveTab('super-dashboard');
      showToast('Berhasil masuk sebagai Super Admin');
    } else {
      showToast('PIN Super Admin Salah! (Gunakan: admin123)', 'error');
    }
  };

  const handleLoginAdmin = (e) => {
    e.preventDefault();
    const classId = e.target.classId.value;
    const pin = e.target.pin.value;
    const selectedClass = allClasses.find(c => c.id === classId);
    
    if (!selectedClass) return showToast('Pilih kelas', 'error');
    if (selectedClass.pin === pin) {
      setCurrentAuth({ isLoggedIn: true, role: 'admin', classId, studentId: null });
      setActiveTab('dashboard');
      showToast(`Berhasil masuk sebagai Bendahara ${selectedClass.name}`);
    } else {
      showToast('PIN Kelas Salah!', 'error');
    }
  };

  const handleLoginSiswa = (e) => {
    e.preventDefault();
    const classId = e.target.classId.value;
    const studentId = e.target.studentId.value;
    if (!classId || !studentId) return showToast('Pilih kelas dan nama Anda', 'error');
    
    setCurrentAuth({ isLoggedIn: true, role: 'siswa', classId, studentId });
    setActiveTab('dashboard');
    showToast(`Berhasil masuk!`);
  };

  const handleLogout = () => {
    setCurrentAuth({ isLoggedIn: false, role: null, classId: null, studentId: null });
    setLoginClassId('');
    setLoginTab('siswa');
    setActiveTab('dashboard');
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const className = formData.get('className').trim();
    const classPin = formData.get('classPin').trim();
    const bendaharaName = formData.get('bendaharaName').trim();
    const iuran = Number(formData.get('iuranBulanan')) || 20000;

    if (!className || !classPin) return showToast('Nama kelas dan PIN wajib diisi', 'error');

    try {
      const basePath = ['artifacts', appId, 'public', 'data'];
      const classId = 'kelas_' + className.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
      
      await setDoc(doc(db, ...basePath, 'classes', classId), {
        name: className, pin: classPin, bendahara: bendaharaName || 'Bendahara Kelas', createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, ...basePath, 'settings', classId), {
        iuranBulanan: iuran, bankName: 'BCA', bankAccount: '1234567890', bankOwner: bendaharaName || 'Bendahara Kelas'
      });

      showToast(`Kelas "${className}" berhasil didaftarkan!`);
      e.target.reset();
    } catch (err) {
      console.error(err);
      showToast('Gagal mendaftarkan kelas', 'error');
    }
  };

  const handleDeleteClass = (classId, className) => {
    confirmAction(`Yakin ingin menghapus kelas "${className}" beserta seluruh data di dalamnya?`, async () => {
      try {
        const basePath = ['artifacts', appId, 'public', 'data'];
        await deleteDoc(doc(db, ...basePath, 'classes', classId));
        await deleteDoc(doc(db, ...basePath, 'settings', classId));
        showToast('Kelas berhasil dihapus.');
      } catch (err) {
        showToast('Gagal menghapus kelas', 'error');
      }
    });
  };

  const handleSubmitPayment = async (month, amount, method) => {
    if (!currentAuth.studentId) return;
    const existing = payments.find(p => p.studentId === currentAuth.studentId && p.month === month && p.year === CURRENT_YEAR);
    if (existing) {
      if (existing.status === 'lunas') return showToast('Bulan ini sudah lunas!', 'error');
      if (existing.status === 'menunggu') return showToast('Pembayaran bulan ini sedang menunggu verifikasi.', 'error');
    }

    try {
      const basePath = ['artifacts', appId, 'public', 'data'];
      await addDoc(collection(db, ...basePath, 'payments'), {
        classId: currentAuth.classId, studentId: currentAuth.studentId, month, year: CURRENT_YEAR, 
        amount, method, status: 'menunggu', timestamp: new Date().toISOString()
      });
      showToast('Pembayaran dikirim. Menunggu verifikasi.');
    } catch (err) { showToast('Gagal mengirim data', 'error'); }
  };

  const handleVerifyPayment = async (paymentId, isApprove) => {
    try {
      const paymentRef = doc(db, 'artifacts', appId, 'public', 'data', 'payments', paymentId);
      if (isApprove) { 
        await updateDoc(paymentRef, { status: 'lunas', verifiedAt: new Date().toISOString() }); 
        showToast('Pembayaran diverifikasi.'); 
      } else { 
        await deleteDoc(paymentRef); 
        showToast('Pembayaran ditolak/dihapus.'); 
      }
    } catch (err) { showToast('Gagal memverifikasi', 'error'); }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      const basePath = ['artifacts', appId, 'public', 'data'];
      await addDoc(collection(db, ...basePath, 'expenses'), {
        classId: currentAuth.classId, date: formData.get('date'), desc: formData.get('desc'), 
        amount: Number(formData.get('amount')), category: formData.get('category'), timestamp: new Date().toISOString()
      });
      showToast('Pengeluaran berhasil dicatat.'); e.target.reset();
    } catch (err) { showToast('Gagal mencatat', 'error'); }
  };
  
  const handleDeleteExpense = (id) => {
    confirmAction('Hapus catatan pengeluaran ini?', async () => {
      try {
        const basePath = ['artifacts', appId, 'public', 'data'];
        await deleteDoc(doc(db, ...basePath, 'expenses', id));
        showToast('Pengeluaran dihapus.');
      } catch (err) { showToast('Gagal menghapus', 'error'); }
    });
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    if (!name) return;
    try {
      const basePath = ['artifacts', appId, 'public', 'data'];
      await addDoc(collection(db, ...basePath, 'students'), { name, classId: currentAuth.classId });
      showToast('Siswa ditambahkan.'); e.target.reset();
    } catch (err) { showToast('Gagal menambahkan siswa', 'error'); }
  };

  const handleDeleteStudent = (id) => {
    confirmAction('Yakin ingin menghapus siswa ini?', async () => {
      try {
        const basePath = ['artifacts', appId, 'public', 'data'];
        await deleteDoc(doc(db, ...basePath, 'students', id));
        showToast('Siswa dihapus.');
      } catch (err) { showToast('Gagal menghapus', 'error'); }
    });
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rows = event.target.result.split('\n').map(r => r.trim()).filter(r => r);
        let count = 0;
        const basePath = ['artifacts', appId, 'public', 'data'];
        
        for (let i = 0; i < rows.length; i++) {
          const name = rows[i].split(',')[0]?.trim();
          if (!name || (i === 0 && name.toLowerCase().includes('nama'))) continue; 
          await addDoc(collection(db, ...basePath, 'students'), { name, classId: currentAuth.classId });
          count++;
        }
        showToast(`${count} Siswa diimpor!`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) { showToast('Gagal memproses CSV', 'error'); }
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Nama Siswa," + MONTHS.join(",") + "\n";
    [...students].sort((a,b) => a.name.localeCompare(b.name)).forEach(student => {
      let row = [student.name];
      for (let i = 0; i < 12; i++) {
        const p = payments.find(p => p.studentId === student.id && p.month === i && p.year === CURRENT_YEAR);
        row.push(p?.status === 'lunas' ? "Lunas" : p?.status === 'menunggu' ? "Menunggu" : "Belum");
      }
      csvContent += row.join(",") + "\n";
    });
    
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `laporan_kas_${activeClass?.name || 'kelas'}_${CURRENT_YEAR}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const updateSettings = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newSettings = {
      iuranBulanan: Number(formData.get('iuranBulanan')),
      bankName: formData.get('bankName'),
      bankAccount: formData.get('bankAccount'),
      bankOwner: formData.get('bankOwner')
    };
    try {
      const basePath = ['artifacts', appId, 'public', 'data'];
      await setDoc(doc(db, ...basePath, 'settings', currentAuth.classId), newSettings);
      showToast('Pengaturan disimpan.');
    } catch (err) { showToast('Gagal menyimpan', 'error'); }
  };

  const pendingVerifications = payments.filter(p => p.status === 'menunggu');

  if (isLoading) return <div className="flex items-center justify-center min-h-screen text-teal-600 bg-slate-50 font-medium">Memuat sistem...</div>;

  if (!currentAuth.isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-teal-600 p-6 text-center">
            <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center mb-4 shadow-inner">
              <Wallet className="w-8 h-8 text-teal-600" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">KasKelas App</h1>
            <p className="text-teal-100 text-sm mt-1">Manajemen Uang Kas</p>
          </div>
          
          <div className="p-6">
            <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
              <button onClick={() => setLoginTab('siswa')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${loginTab === 'siswa' ? 'bg-white shadow text-teal-700' : 'text-slate-500'}`}>Masuk Siswa</button>
              <button onClick={() => setLoginTab('admin')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${loginTab === 'admin' ? 'bg-white shadow text-teal-700' : 'text-slate-500'}`}>Akses Bendahara</button>
            </div>

            {toast && (
              <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${toast.type === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {toast.type === 'error' ? <XCircle className="w-4 h-4"/> : <CheckCircle className="w-4 h-4"/>} {toast.message}
              </div>
            )}

            {loginTab === 'siswa' && (
              <form onSubmit={handleLoginSiswa} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Kelas</label>
                  <select name="classId" value={loginClassId} onChange={(e) => setLoginClassId(e.target.value)} required className="w-full border-slate-300 rounded-xl p-3 border bg-slate-50 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500">
                    <option value="">-- Daftar Kelas --</option>
                    {allClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nama Siswa</label>
                  <select name="studentId" required disabled={!loginClassId} className="w-full border-slate-300 rounded-xl p-3 border bg-slate-50 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:opacity-50">
                    <option value="">{loginClassId ? "-- Pilih Nama Anda --" : "-- Pilih Kelas Dulu --"}</option>
                    {allStudents.filter(s => s.classId === loginClassId).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4">
                  <Users className="w-5 h-5"/> Masuk sebagai Siswa
                </button>
              </form>
            )}

            {loginTab === 'admin' && (
              <form onSubmit={handleLoginAdmin} className="space-y-4">
                <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2"><Lock className="w-4 h-4"/> Login Kelas Terdaftar</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Kelas</label>
                  <select name="classId" required className="w-full border-slate-300 rounded-xl p-3 border bg-slate-50 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500">
                    <option value="">-- Pilih Kelas --</option>
                    {allClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">PIN Keamanan</label>
                  <input type="password" name="pin" required placeholder="Masukkan PIN Kelas" className="w-full border-slate-300 rounded-xl p-3 border bg-slate-50 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" />
                </div>
                <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4">
                  <Lock className="w-4 h-4"/> Masuk Bendahara
                </button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t border-slate-200 text-center">
              <button 
                onClick={() => setLoginTab('superadmin-prompt')} 
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm border border-slate-300">
                <ShieldCheck className="w-4 h-4 text-teal-600" /> Login Super Admin
              </button>
            </div>
          </div>
        </div>

        {loginTab === 'superadmin-prompt' && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <ShieldPlus className="w-5 h-5 text-teal-600" /> Autentikasi Super Admin
                </h3>
                <button onClick={() => setLoginTab('siswa')} className="text-slate-400 hover:text-slate-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-4">Masukkan PIN rahasia Super Admin untuk mengelola data seluruh kelas.</p>
              
              <form onSubmit={handleLoginSuperAdmin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">PIN Super Admin</label>
                  <input type="password" name="pin" required autoFocus placeholder="Default: admin123" className="w-full border-slate-300 rounded-xl p-3 border bg-slate-50 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setLoginTab('siswa')} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition-colors text-sm">Batal</button>
                  <button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">Masuk</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (currentAuth.role === 'superadmin') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12">
        {toast && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white z-50 transition-all flex items-center gap-3 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-600'}`}>
            {toast.type === 'error' ? <XCircle className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>} <p className="font-medium">{toast.message}</p>
          </div>
        )}

        {confirmDialog && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Konfirmasi Aksi</h3>
              <p className="text-slate-500 text-sm mb-6">{confirmDialog.message}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDialog(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl">Batal</button>
                <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl">Yakin</button>
              </div>
            </div>
          </div>
        )}

        <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-slate-200">
          <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-teal-600 p-2 rounded-lg text-white shadow-sm"><ShieldPlus className="w-6 h-6" /></div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Panel Super Admin</h1>
                <p className="text-xs font-medium text-teal-600">Pusat Kendali Sistem KasKelas</p>
              </div>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold text-sm transition-colors">
              <LogOut className="w-4 h-4"/> Keluar
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-teal-50 text-teal-600 rounded-xl"><Building className="w-8 h-8"/></div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase">Total Kelas Terdaftar</p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalKelas} Kelas</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Users className="w-8 h-8"/></div>
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase">Total Seluruh Siswa</p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalSiswaGlobal} Siswa</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
                <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-teal-600"/> Daftarkan Kelas & Bendahara
                </h3>
                <form onSubmit={handleCreateClass} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-slate-700">Nama Kelas</label>
                    <input type="text" name="className" required placeholder="Contoh: XII IPA 1" className="w-full border-slate-300 rounded-xl p-3 border bg-slate-50 outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-slate-700">Nama Bendahara</label>
                    <input type="text" name="bendaharaName" required placeholder="Nama lengkap bendahara" className="w-full border-slate-300 rounded-xl p-3 border bg-slate-50 outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-slate-700">PIN Keamanan Kelas</label>
                    <input type="text" name="classPin" required placeholder="Contoh: 123456" className="w-full border-slate-300 rounded-xl p-3 border bg-slate-50 outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-slate-700">Iuran Bulanan Default (Rp)</label>
                    <input type="number" name="iuranBulanan" defaultValue="20000" required className="w-full border-slate-300 rounded-xl p-3 border bg-slate-50 outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition-colors">Simpan & Buat Kelas</button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-3">Daftar Semua Kelas</h3>
                {allClasses.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">Belum ada kelas yang dibuat.</p>
                ) : (
                  <div className="space-y-3">
                    {allClasses.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <div>
                          <h4 className="font-bold text-slate-800">{c.name}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Bendahara: <strong className="text-slate-700">{c.bendahara}</strong> • PIN Kelas: <code className="bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-mono">{c.pin}</code></p>
                        </div>
                        <button onClick={() => handleDeleteClass(c.id, c.name)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors" title="Hapus Kelas">
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12">
      {toast && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white z-50 transition-all flex items-center gap-3 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-600'}`}>
          {toast.type === 'error' ? <XCircle className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>} <p className="font-medium">{toast.message}</p>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Konfirmasi Aksi</h3>
            <p className="text-slate-500 text-sm mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition-colors">Batal</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl transition-colors">Yakin</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-teal-600 p-2 rounded-lg text-white shadow-sm"><Wallet className="w-6 h-6" /></div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">KasKelas <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-md font-medium">{activeClass?.name}</span></h1>
              <p className="text-xs font-medium text-teal-600">
                {currentAuth.role === 'admin' ? `Akses Bendahara (${activeClass?.bendahara || 'Admin'})` : `Akses Siswa: ${currentStudent?.name}`}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold text-sm transition-colors">
            <LogOut className="w-4 h-4"/> Keluar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'dashboard' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            <TrendingUp className="w-4 h-4" /> Dashboard
          </button>
          
          {currentAuth.role === 'siswa' && (
            <button onClick={() => setActiveTab('bayar')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'bayar' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              <CreditCard className="w-4 h-4" /> Bayar Kas
            </button>
          )}

          {currentAuth.role === 'admin' && (
            <>
              <button onClick={() => setActiveTab('verifikasi')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-colors relative ${activeTab === 'verifikasi' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                <CheckCircle className="w-4 h-4" /> Verifikasi 
                {pendingVerifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white font-bold border-2 border-white shadow-sm">
                    {pendingVerifications.length}
                  </span>
                )}
              </button>
              <button onClick={() => setActiveTab('pengeluaran')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'pengeluaran' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                <TrendingDown className="w-4 h-4" /> Pengeluaran
              </button>
              <button onClick={() => setActiveTab('siswa')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'siswa' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                <Users className="w-4 h-4" /> Manajemen Siswa
              </button>
              <button onClick={() => setActiveTab('pengaturan')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'pengaturan' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                <Key className="w-4 h-4" /> Pengaturan
              </button>
            </>
          )}
          
          <button onClick={() => setActiveTab('laporan')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'laporan' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            <FileText className="w-4 h-4" /> Laporan Tahunan
          </button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-teal-50 rounded-xl text-teal-600"><Wallet className="w-5 h-5" /></div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Saldo Kas Saat Ini</h3>
                </div>
                <p className="text-3xl font-bold text-slate-800">{formatRp(stats.kasSaatIni)}</p>
              </div>
              
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600"><TrendingUp className="w-5 h-5" /></div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Pemasukan</h3>
                </div>
                <p className="text-3xl font-bold text-slate-800">{formatRp(stats.totalPemasukan)}</p>
              </div>
              
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600"><TrendingDown className="w-5 h-5" /></div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Pengeluaran</h3>
                </div>
                <p className="text-3xl font-bold text-slate-800">{formatRp(stats.totalPengeluaran)}</p>
              </div>
              
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600"><Users className="w-5 h-5" /></div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Tunggakan Bulan Ini</h3>
                </div>
                <p className="text-3xl font-bold text-slate-800">{stats.tunggakanCount} <span className="text-base font-medium text-slate-500">Siswa</span></p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                <History className="w-5 h-5 text-slate-500" />
                <h3 className="text-lg font-bold text-slate-800">Aktivitas Terakhir</h3>
              </div>
              
              {recentActivities.length === 0 ? (
                <div className="text-center py-8 text-slate-500">Belum ada aktivitas tercatat di kelas ini.</div>
              ) : (
                <div className="space-y-4">
                  {recentActivities.map((act, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-4">
                        {act.type === 'payment' ? (
                          <div className={`p-3 rounded-full ${act.status === 'lunas' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                            {act.status === 'lunas' ? <TrendingUp className="w-4 h-4"/> : <Clock className="w-4 h-4"/>}
                          </div>
                        ) : (
                          <div className="p-3 rounded-full bg-rose-100 text-rose-600"><TrendingDown className="w-4 h-4"/></div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-800">
                            {act.type === 'payment' ? `Iuran Kas - ${getStudentName(act.studentId)}` : act.desc}
                          </p>
                          <p className="text-sm text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {act.displayDate} 
                            {act.type === 'payment' && ` • Bulan ${MONTHS[act.month]} ${act.year}`}
                            {act.type === 'payment' && act.status === 'menunggu' && (
                              <span className="ml-2 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Menunggu</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className={`font-bold ${act.type === 'payment' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {act.type === 'payment' ? '+' : '-'}{formatRp(act.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'bayar' && currentAuth.role === 'siswa' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">Form Pembayaran</h3>
                      <p className="text-sm text-slate-500">Iuran bulanan: <strong className="text-slate-800">{formatRp(settings.iuranBulanan)}</strong>/bulan</p>
                    </div>
                  </div>

                  <form onSubmit={(e) => { 
                    e.preventDefault(); 
                    handleSubmitPayment(Number(new FormData(e.target).get('month')), settings.iuranBulanan, 'transfer'); 
                  }} className="space-y-5">
                    
                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-slate-700">Bayar Untuk Bulan</label>
                      <select name="month" required className="w-full rounded-xl p-3.5 border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none">
                        {MONTHS.map((m, i) => {
                          const p = payments.find(p => p.studentId === currentAuth.studentId && p.month === i && p.year === CURRENT_YEAR);
                          let statusText = "", disabled = false;
                          if (p) {
                            if (p.status === 'lunas') { statusText = " (Sudah Lunas)"; disabled = true; }
                            else if (p.status === 'menunggu') { statusText = " (Menunggu Verifikasi)"; disabled = true; }
                          }
                          return <option key={m} value={i} disabled={disabled}>{m} {CURRENT_YEAR} {statusText}</option>;
                        })}
                      </select>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <p className="text-sm text-blue-800 font-medium mb-2">Instruksi Transfer:</p>
                      <p className="text-sm text-blue-700">Silakan transfer sebesar <strong>{formatRp(settings.iuranBulanan)}</strong> ke rekening berikut:</p>
                      <div className="mt-3 flex items-center justify-between bg-white p-3 rounded-lg border border-blue-200">
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-semibold">{settings.bankName}</p>
                          <p className="font-bold text-slate-800 tracking-wider">{settings.bankAccount}</p>
                          <p className="text-xs text-slate-600">a.n. {settings.bankOwner}</p>
                        </div>
                        <button type="button" onClick={() => copyToClipboard(settings.bankAccount)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg flex flex-col items-center gap-1 transition-colors">
                          <Copy className="w-4 h-4"/> <span className="text-[10px] font-bold">Salin</span>
                        </button>
                      </div>
                    </div>

                    <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 transition-colors text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-sm">
                      <CheckCircle className="w-5 h-5"/> Kirim Bukti Pembayaran
                    </button>
                  </form>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
                   <h3 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Status Pembayaran {CURRENT_YEAR}</h3>
                   <div className="space-y-3">
                      {MONTHS.map((m, i) => {
                         const p = payments.find(pay => pay.studentId === currentAuth.studentId && pay.month === i && pay.year === CURRENT_YEAR);
                         let statusIcon, statusColor, statusText;
                         if (p?.status === 'lunas') {
                            statusIcon = <CheckCircle className="w-4 h-4" />; statusColor = "text-emerald-600 bg-emerald-50"; statusText = "Lunas";
                         } else if (p?.status === 'menunggu') {
                            statusIcon = <Clock className="w-4 h-4" />; statusColor = "text-amber-600 bg-amber-50"; statusText = "Menunggu";
                         } else {
                            statusIcon = <XCircle className="w-4 h-4" />; statusColor = "text-rose-500 bg-rose-50"; statusText = "Belum";
                         }

                         return (
                           <div key={i} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0">
                             <span className="font-medium text-slate-600">{m}</span>
                             <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusColor}`}>
                               {statusIcon} {statusText}
                             </span>
                           </div>
                         );
                      })}
                   </div>
                </div>
              </div>
           </div>
        )}

        {activeTab === 'verifikasi' && currentAuth.role === 'admin' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center"><Clock className="w-5 h-5" /></div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">Menunggu Verifikasi</h3>
                <p className="text-sm text-slate-500">Konfirmasi pembayaran kas yang diajukan oleh siswa kelas {activeClass?.name}.</p>
              </div>
            </div>

            {pendingVerifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <CheckCircle className="w-16 h-16 mb-4 text-emerald-200" />
                <p className="text-lg font-medium text-slate-500">Tidak ada pembayaran yang menunggu.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50">
                    <tr className="border-y border-slate-200 text-sm text-slate-500">
                      <th className="py-3 px-4 font-semibold">Tgl Pengajuan</th>
                      <th className="py-3 px-4 font-semibold">Nama Siswa</th>
                      <th className="py-3 px-4 font-semibold">Bulan</th>
                      <th className="py-3 px-4 font-semibold">Nominal</th>
                      <th className="py-3 px-4 font-semibold text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {pendingVerifications.map((pay) => (
                      <tr key={pay.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-4 text-slate-600">{new Date(pay.timestamp).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</td>
                        <td className="py-4 px-4 font-bold text-slate-800">{getStudentName(pay.studentId)}</td>
                        <td className="py-4 px-4 text-slate-600">{MONTHS[pay.month]} {pay.year}</td>
                        <td className="py-4 px-4 font-semibold text-emerald-600">{formatRp(pay.amount)}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleVerifyPayment(pay.id, true)} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors"><CheckCircle className="w-4 h-4"/> Terima</button>
                            <button onClick={() => handleVerifyPayment(pay.id, false)} className="bg-rose-100 text-rose-700 hover:bg-rose-200 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors"><XCircle className="w-4 h-4"/> Tolak</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pengeluaran' && currentAuth.role === 'admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
                <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-2"><TrendingDown className="w-5 h-5 text-rose-500" /> Catat Pengeluaran</h3>
                <form onSubmit={handleAddExpense} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-slate-700">Tanggal</label>
                    <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full border-slate-300 rounded-xl p-2.5 border bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-slate-700">Keterangan</label>
                    <input type="text" name="desc" required placeholder="Contoh: Fotokopi materi..." className="w-full border-slate-300 rounded-xl p-2.5 border bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-slate-700">Kategori</label>
                    <select name="category" required className="w-full border-slate-300 rounded-xl p-2.5 border bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none">
                      <option value="Perlengkapan">Perlengkapan Kelas</option>
                      <option value="Kegiatan">Kegiatan / Event</option>
                      <option value="Fotokopi">Fotokopi / Tugas</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-slate-700">Nominal (Rp)</label>
                    <input type="number" name="amount" min="1000" required placeholder="Contoh: 50000" className="w-full border-slate-300 rounded-xl p-2.5 border bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                  <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl mt-2 transition-colors">Simpan Pengeluaran</button>
                </form>
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center justify-between">
                  <span>Riwayat Pengeluaran</span>
                  <span className="text-sm font-medium text-rose-600 bg-rose-50 px-3 py-1 rounded-full">Total: {formatRp(stats.totalPengeluaran)}</span>
                </h3>
                
                {expenses.length === 0 ? (
                   <p className="text-slate-500 text-center py-8">Belum ada catatan pengeluaran kelas ini.</p>
                ) : (
                  <div className="overflow-x-auto max-h-[600px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-white shadow-sm">
                        <tr className="border-b border-slate-200 text-sm text-slate-500">
                          <th className="py-3 px-3 font-semibold whitespace-nowrap">Tanggal</th>
                          <th className="py-3 px-3 font-semibold">Keterangan</th>
                          <th className="py-3 px-3 font-semibold">Kategori</th>
                          <th className="py-3 px-3 font-semibold">Nominal</th>
                          <th className="py-3 px-3 font-semibold text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {[...expenses].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(exp => (
                          <tr key={exp.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{new Date(exp.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'})}</td>
                            <td className="py-3 px-3 font-medium text-slate-800">{exp.desc}</td>
                            <td className="py-3 px-3 text-slate-500"><span className="bg-slate-100 px-2 py-1 rounded-md text-xs">{exp.category}</span></td>
                            <td className="py-3 px-3 font-bold text-rose-600 whitespace-nowrap">{formatRp(exp.amount)}</td>
                            <td className="py-3 px-3 text-right">
                              <button onClick={() => handleDeleteExpense(exp.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'siswa' && currentAuth.role === 'admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-2"><UserPlus className="w-5 h-5 text-teal-600"/> Tambah Manual</h3>
                <form onSubmit={handleAddStudent} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Lengkap Siswa</label>
                    <input type="text" name="name" required placeholder="Masukkan nama..." className="w-full border-slate-300 rounded-xl p-3 border bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                  <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl transition-colors">Simpan Data</button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2 border-b border-slate-100 pb-2"><Upload className="w-5 h-5 text-teal-600"/> Import CSV</h3>
                <p className="text-xs text-slate-500 mb-4 mt-2">Gunakan file .csv dengan 1 kolom berjudul "Nama". Data akan masuk ke kelas <strong>{activeClass?.name}</strong>.</p>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer" />
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <h3 className="text-lg font-bold">Daftar Siswa {activeClass?.name}</h3>
                  <span className="bg-teal-100 text-teal-700 font-bold px-3 py-1 rounded-full text-sm">{students.length} Orang</span>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white shadow-sm z-10">
                      <tr className="border-b border-slate-200 text-sm text-slate-500">
                        <th className="py-3 px-3 font-semibold w-12 text-center">No</th>
                        <th className="py-3 px-3 font-semibold">Nama Lengkap</th>
                        <th className="py-3 px-3 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {students.length === 0 ? (
                        <tr><td colSpan="3" className="text-center py-6 text-slate-500">Belum ada data siswa di kelas ini.</td></tr>
                      ) : (
                        [...students].sort((a,b) => a.name.localeCompare(b.name)).map((student, idx) => (
                          <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-3 text-slate-500 text-center">{idx + 1}</td>
                            <td className="py-3 px-3 font-bold text-slate-800">{student.name}</td>
                            <td className="py-3 px-3 text-right">
                              <button onClick={() => handleDeleteStudent(student.id)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pengaturan' && currentAuth.role === 'admin' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2 border-b border-slate-100 pb-4"><Key className="w-6 h-6 text-teal-600"/> Pengaturan Kelas {activeClass?.name}</h3>
              <form onSubmit={updateSettings} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nominal Iuran per Bulan (Rp)</label>
                  <input type="number" name="iuranBulanan" defaultValue={settings.iuranBulanan} required className="w-full border-slate-300 rounded-xl p-3 border bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Bank / E-Wallet</label>
                    <input type="text" name="bankName" defaultValue={settings.bankName} required className="w-full border-slate-300 rounded-xl p-3 border bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Atas Nama Rekening</label>
                    <input type="text" name="bankOwner" defaultValue={settings.bankOwner} required className="w-full border-slate-300 rounded-xl p-3 border bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nomor Rekening / No HP</label>
                  <input type="text" name="bankAccount" defaultValue={settings.bankAccount} required className="w-full border-slate-300 rounded-xl p-3 border bg-slate-50 focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
                <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl transition-colors mt-4">Simpan Pengaturan</button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'laporan' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Matriks Iuran Kas Tahun {CURRENT_YEAR}</h3>
                <p className="text-sm text-slate-500 mt-1">Rekapitulasi pembayaran bulanan kelas {activeClass?.name}.</p>
              </div>
              <button onClick={handleExportCSV} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm">
                <Download className="w-4 h-4" /> Export ke Excel (CSV)
              </button>
             </div>
             
             <div className="overflow-x-auto p-0">
               <table className="w-full text-left border-collapse min-w-max">
                 <thead className="bg-slate-50 border-b border-slate-200">
                   <tr className="text-xs uppercase text-slate-500 font-bold tracking-wider">
                     <th className="py-4 px-4 sticky left-0 bg-slate-50 z-20 border-r border-slate-200 shadow-[1px_0_0_rgba(0,0,0,0.05)]">Nama Siswa</th>
                     {MONTHS.map(m => <th key={m} className="py-4 px-3 text-center min-w-[60px]">{m}</th>)}
                   </tr>
                 </thead>
                 <tbody className="text-sm">
                   {students.length === 0 ? (
                     <tr><td colSpan="13" className="text-center py-10 text-slate-500">Tidak ada data siswa.</td></tr>
                   ) : (
                     [...students].sort((a,b) => a.name.localeCompare(b.name)).map((student) => (
                       <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                         <td className="py-3 px-4 font-bold text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[1px_0_0_rgba(0,0,0,0.05)] whitespace-nowrap">
                           {student.name}
                         </td>
                         {MONTHS.map((m, i) => {
                           const p = payments.find(pay => pay.studentId === student.id && pay.month === i && pay.year === CURRENT_YEAR);
                           return (
                             <td key={m} className="py-3 px-3 text-center">
                               {p?.status === 'lunas' ? (
                                 <div className="w-8 h-8 mx-auto bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-sm" title="Lunas"><CheckCircle className="w-4 h-4" /></div>
                               ) : p?.status === 'menunggu' ? (
                                 <div className="w-8 h-8 mx-auto bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shadow-sm" title="Menunggu Verifikasi"><Clock className="w-4 h-4" /></div>
                               ) : (
                                 <div className="w-8 h-8 mx-auto bg-slate-100 text-slate-300 rounded-full flex items-center justify-center" title="Belum Bayar"><span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span></div>
                               )}
                             </td>
                           );
                         })}
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
