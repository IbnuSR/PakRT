import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import {
  Wallet, ArrowUpCircle, ArrowDownCircle, Users,
  ShieldCheck, PlusCircle, CheckCircle2, Clock, FileText,
  LogIn, LogOut, UserPlus, Search, X, Calendar, MapPin,
  Download, Trash2, Sparkles, TrendingUp, Radio
} from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [transactions, setTransactions] = useState([]);
  const [wargaList, setWargaList] = useState([]);
  const [infoList, setInfoList] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [activeTab, setActiveTab] = useState('kas');
  const [filterBulan, setFilterBulan] = useState('ALL');
  const [searchWarga, setSearchWarga] = useState('');

  const [keterangan, setKeterangan] = useState('');
  const [nominal, setNominal] = useState('');
  const [tipe, setTipe] = useState('masuk');

  const [namaKK, setNamaKK] = useState('');
  const [nomorRumah, setNomorRumah] = useState('');
  const [nominalIuran, setNominalIuran] = useState('50000');

  const [kategoriInfo, setKategoriInfo] = useState('Kegiatan');
  const [judulInfo, setJudulInfo] = useState('');
  const [lokasiJadwal, setLokasiJadwal] = useState('');
  const [deskripsiInfo, setDeskripsiInfo] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadingData(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const fetchData = async () => {
      setLoadingData(true);
      const [trxRes, wargaRes, infoRes] = await Promise.all([
        supabase.from('transactions').select('*').order('tanggal', { ascending: false }).order('id', { ascending: false }),
        supabase.from('warga_iuran').select('*').order('nomor_rumah', { ascending: true }),
        supabase.from('kegiatan_info').select('*').order('created_at', { ascending: false })
      ]);

      if (!trxRes.error) setTransactions(trxRes.data || []);
      if (!wargaRes.error) setWargaList(wargaRes.data || []);
      if (!infoRes.error) setInfoList(infoRes.data || []);
      setLoadingData(false);
    };

    fetchData();

    const channel = supabase
      .channel('pakrt-modern-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTransactions((prev) => [payload.new, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setTransactions((prev) => prev.filter((item) => item.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warga_iuran' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setWargaList((prev) => [...prev, payload.new].sort((a, b) => a.nomor_rumah.localeCompare(b.nomor_rumah)));
        } else if (payload.eventType === 'UPDATE') {
          setWargaList((prev) => prev.map((w) => (w.id === payload.new.id ? payload.new : w)));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kegiatan_info' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setInfoList((prev) => [payload.new, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setInfoList((prev) => prev.filter((item) => item.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const bulanOptions = useMemo(() => {
    const setBulan = new Set(
      transactions.map((t) => (t.tanggal ? t.tanggal.slice(0, 7) : '')).filter(Boolean)
    );
    return Array.from(setBulan).sort().reverse();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (filterBulan === 'ALL') return transactions;
    return transactions.filter((t) => (t.tanggal || '').startsWith(filterBulan));
  }, [transactions, filterBulan]);

  const { totalMasuk, totalKeluar, saldoAkhir, laporanPeriode } = useMemo(() => {
    const masukAll = transactions.filter((t) => t.tipe === 'masuk').reduce((a, b) => a + Number(b.nominal), 0);
    const keluarAll = transactions.filter((t) => t.tipe === 'keluar').reduce((a, b) => a + Number(b.nominal), 0);

    const masukPeriode = filteredTransactions.filter((t) => t.tipe === 'masuk').reduce((a, b) => a + Number(b.nominal), 0);
    const keluarPeriode = filteredTransactions.filter((t) => t.tipe === 'keluar').reduce((a, b) => a + Number(b.nominal), 0);

    return {
      totalMasuk: masukAll,
      totalKeluar: keluarAll,
      saldoAkhir: masukAll - keluarAll,
      laporanPeriode: {
        masuk: masukPeriode,
        keluar: keluarPeriode,
        selisih: masukPeriode - keluarPeriode,
        jumlah: filteredTransactions.length
      }
    };
  }, [transactions, filteredTransactions]);

  const statsIuran = useMemo(() => {
    const total = wargaList.length;
    const lunas = wargaList.filter((w) => w.status_lunas).length;
    const persen = total > 0 ? Math.round((lunas / total) * 100) : 0;
    return { total, lunas, persen };
  }, [wargaList]);

  const filteredWarga = useMemo(() => {
    return wargaList.filter(
      (w) =>
        w.nama_kk.toLowerCase().includes(searchWarga.toLowerCase()) ||
        w.nomor_rumah.toLowerCase().includes(searchWarga.toLowerCase())
    );
  }, [wargaList, searchWarga]);

  const formatRupiah = (angka) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

  const handleExportExcel = () => {
    const rowsMutasi = filteredTransactions.map((item, idx) => ({
      No: idx + 1,
      Tanggal: item.tanggal,
      Jenis: item.tipe === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
      Keterangan: item.keterangan,
      Nominal_Rp: Number(item.nominal)
    }));

    const rowsRingkasan = [
      { Keterangan: 'Periode Laporan', Nilai: filterBulan === 'ALL' ? 'Semua Periode' : filterBulan },
      { Keterangan: 'Total Pemasukan Periode', Nilai: laporanPeriode.masuk },
      { Keterangan: 'Total Pengeluaran Periode', Nilai: laporanPeriode.keluar },
      { Keterangan: 'Selisih Periode', Nilai: laporanPeriode.selisih },
      { Keterangan: 'Saldo Kas Saat Ini (Keseluruhan)', Nilai: saldoAkhir }
    ];

    const wb = XLSX.utils.book_new();
    const wsMutasi = XLSX.utils.json_to_sheet(rowsMutasi);
    const wsRingkasan = XLSX.utils.json_to_sheet(rowsRingkasan);

    XLSX.utils.book_append_sheet(wb, wsMutasi, 'Mutasi Kas');
    XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan Laporan');

    const namaFile = `Laporan_Kas_PakRT_${filterBulan === 'ALL' ? 'Lengkap' : filterBulan}.xlsx`;
    XLSX.writeFile(wb, namaFile);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError('Email atau kata sandi salah. Silakan cek kembali.');
    } else {
      setShowLoginModal(false);
      setEmail('');
      setPassword('');
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleTambahTransaksi = async (e) => {
    e.preventDefault();
    if (!keterangan.trim() || !nominal || Number(nominal) <= 0) return;

    const { error } = await supabase.from('transactions').insert([
      {
        tanggal: new Date().toISOString().split('T')[0],
        keterangan: keterangan.trim(),
        tipe,
        nominal: Number(nominal),
      },
    ]);

    if (!error) {
      setKeterangan('');
      setNominal('');
    } else {
      alert('Gagal menyimpan transaksi: ' + error.message);
    }
  };

  const handleTambahWarga = async (e) => {
    e.preventDefault();
    if (!namaKK.trim() || !nomorRumah.trim()) return;

    const { error } = await supabase.from('warga_iuran').insert([
      {
        nama_kk: namaKK.trim(),
        nomor_rumah: nomorRumah.trim(),
        nominal_iuran: Number(nominalIuran) || 50000,
        status_lunas: false,
      },
    ]);

    if (!error) {
      setNamaKK('');
      setNomorRumah('');
    } else {
      alert('Gagal menambah warga: ' + error.message);
    }
  };

  const handleTandaiLunas = async (warga) => {
    if (!session || warga.status_lunas) return;

    const konfirmasi = window.confirm(
      `Tandai iuran ${warga.nama_kk} (Rumah ${warga.nomor_rumah}) sebesar ${formatRupiah(warga.nominal_iuran)} sebagai LUNAS? Nominal akan otomatis masuk ke Kas RT.`
    );
    if (!konfirmasi) return;

    const { error: updateErr } = await supabase
      .from('warga_iuran')
      .update({ status_lunas: true, updated_at: new Date().toISOString() })
      .eq('id', warga.id);

    if (updateErr) {
      alert('Gagal memperbarui status warga: ' + updateErr.message);
      return;
    }

    await supabase.from('transactions').insert([
      {
        tanggal: new Date().toISOString().split('T')[0],
        keterangan: `Iuran Wajib - ${warga.nama_kk} (No. ${warga.nomor_rumah})`,
        tipe: 'masuk',
        nominal: Number(warga.nominal_iuran),
      },
    ]);
  };

  const handleTambahInfo = async (e) => {
    e.preventDefault();
    if (!judulInfo.trim() || !lokasiJadwal.trim() || !deskripsiInfo.trim()) return;

    const { error } = await supabase.from('kegiatan_info').insert([
      {
        kategori: kategoriInfo,
        judul: judulInfo.trim(),
        jadwal_atau_lokasi: lokasiJadwal.trim(),
        deskripsi: deskripsiInfo.trim(),
      },
    ]);

    if (!error) {
      setJudulInfo('');
      setLokasiJadwal('');
      setDeskripsiInfo('');
    } else {
      alert('Gagal menyimpan info/kegiatan: ' + error.message);
    }
  };

  const handleHapusInfo = async (id) => {
    if (!session) return;
    const yakin = window.confirm('Hapus informasi/kegiatan ini?');
    if (!yakin) return;
    await supabase.from('kegiatan_info').delete().eq('id', id);
  };

  const navItems = [
    { id: 'kas', label: 'Kas & Laporan', icon: FileText },
    { id: 'iuran', label: `Iuran (${statsIuran.lunas}/${statsIuran.total})`, icon: Users },
    { id: 'info', label: `Kegiatan & Info (${infoList.length})`, icon: Sparkles },
  ];

  return (
    <div className="min-h-screen pb-24 relative overflow-x-clip">
      {/* DEKORASI CAHAYA HIJAU LEMBUT DI LATAR BELAKANG */}
      <div className="fixed -top-28 -left-24 w-96 h-96 bg-emerald-300/25 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-48 -right-28 w-96 h-96 bg-teal-300/20 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* TOPBAR GLASSMORPHISM */}
      <header className="sticky top-0 z-30 bg-white/75 backdrop-blur-xl border-b border-emerald-900/5">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.05, rotate: -4 }}
              whileTap={{ scale: 0.95 }}
              className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/25"
            >
              <ShieldCheck className="w-6 h-6" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-emerald-950 tracking-tight leading-none">
                  PakRT
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  <Radio className="w-3 h-3 text-emerald-600 animate-pulse" /> Sinkron
                </span>
              </div>
              <p className="text-xs md:text-sm text-emerald-800/80 font-medium mt-0.5">
                Dashboard Kas & Lingkungan RT 01
              </p>
            </div>
          </div>

          {session ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-600/10 text-emerald-900 border border-emerald-600/20 px-3 py-1.5 rounded-xl">
                Pengurus Aktif
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-sm border border-rose-200/80 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Keluar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" /> Masuk Pengurus
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        {/* HERO DASHBOARD RINGKASAN UTAMA */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="glass-panel p-6 md:p-8 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/[0.06] via-transparent to-teal-500/[0.06] pointer-events-none" />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Saldo Utama */}
            <div className="lg:col-span-7 space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-600/10 text-emerald-900 text-xs md:text-sm font-bold">
                <Wallet className="w-4 h-4 text-emerald-600" /> Saldo Kas RT 01 Saat Ini
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-emerald-950 tracking-tight pt-1">
                {loadingData ? 'Memuat saldo...' : formatRupiah(saldoAkhir)}
              </h2>
              <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                Terbuka untuk seluruh warga dan langsung terbarui otomatis dari HP maupun web.
              </p>

              {/* Progress Partisipasi Iuran Warga */}
              <div className="pt-3 max-w-md">
                <div className="flex items-center justify-between text-xs md:text-sm font-bold text-emerald-950 mb-1.5">
                  <span>Partisipasi Iuran Warga</span>
                  <span>{statsIuran.lunas} / {statsIuran.total} KK ({statsIuran.persen}%)</span>
                </div>
                <div className="w-full h-3 rounded-full bg-emerald-900/10 overflow-hidden p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${statsIuran.persen}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"
                  />
                </div>
              </div>
            </div>

            {/* Dua Kartu Metrik Samping */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Total Pemasukan
                  </span>
                  <p className="text-xl md:text-2xl font-extrabold text-emerald-950 mt-0.5">
                    {formatRupiah(totalMasuk)}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                  <ArrowUpCircle className="w-6 h-6" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                    Total Pengeluaran
                  </span>
                  <p className="text-xl md:text-2xl font-extrabold text-rose-950 mt-0.5">
                    {formatRupiah(totalKeluar)}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/20">
                  <ArrowDownCircle className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* SEGMENTED NAVIGATION BAR MODERN */}
        <nav className="glass-pill p-1.5 grid grid-cols-3 gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative h-12 md:h-13 rounded-xl font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  isActive ? 'text-white' : 'text-emerald-950 hover:bg-emerald-900/5'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabPill"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-600/25"
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon className="w-4 h-4 md:w-5 h-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* KONTEN DINAMIS PER TAB */}
        <AnimatePresence mode="wait">
          {/* ================= TAB 1: KAS & LAPORAN EXCEL ================= */}
          {activeTab === 'kas' && (
            <motion.div
              key="tab-kas"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {session && (
                <section className="glass-panel p-6 border-2 border-emerald-400/50 bg-white/85">
                  <h3 className="text-lg md:text-xl font-extrabold text-emerald-950 flex items-center gap-2 mb-4">
                    <PlusCircle className="w-6 h-6 text-emerald-600" />
                    Catat Transaksi Kas Baru
                  </h3>

                  <form onSubmit={handleTambahTransaksi} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Jenis</label>
                      <select
                        value={tipe}
                        onChange={(e) => setTipe(e.target.value)}
                        className="w-full h-12 px-4 rounded-2xl border border-emerald-200 bg-white/90 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="masuk">Uang Masuk (+)</option>
                        <option value="keluar">Uang Keluar (-)</option>
                      </select>
                    </div>

                    <div className="md:col-span-5">
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Keterangan</label>
                      <input
                        type="text"
                        placeholder="Contoh: Kas Bulanan / Perbaikan Lampu"
                        value={keterangan}
                        onChange={(e) => setKeterangan(e.target.value)}
                        className="w-full h-12 px-4 rounded-2xl border border-emerald-200 bg-white/90 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Nominal (Rp)</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="50000"
                          value={nominal}
                          onChange={(e) => setNominal(e.target.value)}
                          className="w-full h-12 px-4 rounded-2xl border border-emerald-200 bg-white/90 text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                        <button
                          type="submit"
                          className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition-all shrink-0 cursor-pointer"
                        >
                          Simpan
                        </button>
                      </div>
                    </div>
                  </form>
                </section>
              )}

              {/* LAPORAN KAS & CETAK EXCEL */}
              <section className="glass-panel p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full mb-1">
                      <TrendingUp className="w-3.5 h-3.5" /> Rekapitulasi Keuangan
                    </span>
                    <h3 className="text-xl font-extrabold text-emerald-950">
                      Laporan & Mutasi Kas
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <select
                      value={filterBulan}
                      onChange={(e) => setFilterBulan(e.target.value)}
                      className="h-12 px-4 rounded-2xl border border-emerald-200 bg-white/90 text-sm font-bold text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="ALL">Semua Periode</option>
                      {bulanOptions.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>

                    <button
                      onClick={handleExportExcel}
                      className="h-12 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-sm flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" /> Cetak Excel (.xlsx)
                    </button>
                  </div>
                </div>

                {/* Mini Summary Periode Terpilih */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-white/70 border border-emerald-100">
                    <p className="text-xs font-semibold text-slate-500">Masuk Periode Ini</p>
                    <p className="text-lg font-extrabold text-emerald-700 mt-0.5">
                      {formatRupiah(laporanPeriode.masuk)}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/70 border border-emerald-100">
                    <p className="text-xs font-semibold text-slate-500">Keluar Periode Ini</p>
                    <p className="text-lg font-extrabold text-rose-600 mt-0.5">
                      {formatRupiah(laporanPeriode.keluar)}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/70 border border-emerald-100">
                    <p className="text-xs font-semibold text-slate-500">Selisih Periode</p>
                    <p className="text-lg font-extrabold text-emerald-950 mt-0.5">
                      {formatRupiah(laporanPeriode.selisih)}
                    </p>
                  </div>
                </div>

                {/* Daftar Transaksi */}
                {filteredTransactions.length === 0 ? (
                  <p className="text-center py-8 text-slate-500 text-base">
                    Belum ada catatan transaksi kas pada periode ini.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredTransactions.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/80 hover:bg-white border border-emerald-900/5 transition-all"
                      >
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`p-2.5 rounded-2xl shrink-0 mt-0.5 ${
                              item.tipe === 'masuk'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {item.tipe === 'masuk' ? (
                              <ArrowUpCircle className="w-6 h-6" />
                            ) : (
                              <ArrowDownCircle className="w-6 h-6" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-base md:text-lg leading-snug">
                              {item.keterangan}
                            </p>
                            <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3.5 h-3.5" /> {item.tanggal}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`font-extrabold text-base md:text-lg shrink-0 ml-2 ${
                            item.tipe === 'masuk' ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {item.tipe === 'masuk' ? '+' : '-'} {formatRupiah(item.nominal)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {/* ================= TAB 2: IURAN WARGA ================= */}
          {activeTab === 'iuran' && (
            <motion.div
              key="tab-iuran"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {session && (
                <section className="glass-panel p-6 border-2 border-emerald-400/50 bg-white/85">
                  <h3 className="text-lg md:text-xl font-extrabold text-emerald-950 flex items-center gap-2 mb-4">
                    <UserPlus className="w-6 h-6 text-emerald-600" />
                    Tambah Kepala Keluarga (KK)
                  </h3>

                  <form onSubmit={handleTambahWarga} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-5">
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Nama Kepala Keluarga</label>
                      <input
                        type="text"
                        placeholder="Contoh: Bpk. Ahmad Sutrisno"
                        value={namaKK}
                        onChange={(e) => setNamaKK(e.target.value)}
                        className="w-full h-12 px-4 rounded-2xl border border-emerald-200 bg-white/90 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">No. Rumah / Blok</label>
                      <input
                        type="text"
                        placeholder="Contoh: A-01"
                        value={nomorRumah}
                        onChange={(e) => setNomorRumah(e.target.value)}
                        className="w-full h-12 px-4 rounded-2xl border border-emerald-200 bg-white/90 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Iuran Bulanan (Rp)</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={nominalIuran}
                          onChange={(e) => setNominalIuran(e.target.value)}
                          className="w-full h-12 px-4 rounded-2xl border border-emerald-200 bg-white/90 text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                        <button
                          type="submit"
                          className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition-all shrink-0 cursor-pointer"
                        >
                          Tambah
                        </button>
                      </div>
                    </div>
                  </form>
                </section>
              )}

              <section className="glass-panel p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-extrabold text-emerald-950">
                      Status Iuran Bulanan Warga
                    </h3>
                    <p className="text-sm text-slate-600">
                      {statsIuran.lunas} lunas dari {statsIuran.total} KK ({statsIuran.persen}%)
                    </p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      placeholder="Cari nama / no rumah..."
                      value={searchWarga}
                      onChange={(e) => setSearchWarga(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 rounded-2xl border border-emerald-200 bg-white/90 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {filteredWarga.length === 0 ? (
                  <p className="text-center py-8 text-slate-500 text-base">
                    Data warga belum tersedia atau tidak ditemukan.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filteredWarga.map((warga) => (
                      <div
                        key={warga.id}
                        className="p-4 rounded-2xl bg-white/80 hover:bg-white border border-emerald-900/5 flex items-center justify-between gap-3 transition-all"
                      >
                        <div>
                          <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800">
                            Rumah {warga.nomor_rumah}
                          </span>
                          <h4 className="font-bold text-slate-900 text-base md:text-lg mt-1.5">
                            {warga.nama_kk}
                          </h4>
                          <p className="text-sm text-slate-600 font-semibold">
                            {formatRupiah(warga.nominal_iuran)}
                          </p>
                        </div>

                        {warga.status_lunas ? (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-sm shrink-0">
                            <CheckCircle2 className="w-4 h-4" /> Lunas
                          </span>
                        ) : session ? (
                          <button
                            onClick={() => handleTandaiLunas(warga)}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-all shrink-0 cursor-pointer"
                          >
                            Tandai Lunas
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-100 text-amber-800 font-bold text-sm shrink-0">
                            <Clock className="w-4 h-4" /> Belum Bayar
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {/* ================= TAB 3: KEGIATAN & INFO LINGKUNGAN ================= */}
          {activeTab === 'info' && (
            <motion.div
              key="tab-info"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {session && (
                <section className="glass-panel p-6 border-2 border-emerald-400/50 bg-white/85">
                  <h3 className="text-lg md:text-xl font-extrabold text-emerald-950 flex items-center gap-2 mb-4">
                    <PlusCircle className="w-6 h-6 text-emerald-600" />
                    Publikasikan Kegiatan atau Info Lingkungan
                  </h3>

                  <form onSubmit={handleTambahInfo} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Kategori</label>
                      <select
                        value={kategoriInfo}
                        onChange={(e) => setKategoriInfo(e.target.value)}
                        className="w-full h-12 px-4 rounded-2xl border border-emerald-200 bg-white/90 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Kegiatan">Kegiatan</option>
                        <option value="Info Lingkungan">Info Lingkungan</option>
                        <option value="Pengumuman">Pengumuman</option>
                      </select>
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Judul</label>
                      <input
                        type="text"
                        placeholder="Contoh: Kerja Bakti / Pos Kamling"
                        value={judulInfo}
                        onChange={(e) => setJudulInfo(e.target.value)}
                        className="w-full h-12 px-4 rounded-2xl border border-emerald-200 bg-white/90 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-5">
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Jadwal / Lokasi</label>
                      <input
                        type="text"
                        placeholder="Contoh: Minggu 07.00 WIB • Balai RT 01"
                        value={lokasiJadwal}
                        onChange={(e) => setLokasiJadwal(e.target.value)}
                        className="w-full h-12 px-4 rounded-2xl border border-emerald-200 bg-white/90 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-12 flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        placeholder="Penjelasan singkat yang jelas dan mudah dipahami warga..."
                        value={deskripsiInfo}
                        onChange={(e) => setDeskripsiInfo(e.target.value)}
                        className="flex-1 h-12 px-4 rounded-2xl border border-emerald-200 bg-white/90 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                      <button
                        type="submit"
                        className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition-all shrink-0 cursor-pointer"
                      >
                        Publikasikan
                      </button>
                    </div>
                  </form>
                </section>
              )}

              <section className="glass-panel p-6 space-y-4">
                <h3 className="text-xl font-extrabold text-emerald-950">
                  Kegiatan & Info Lingkungan RT 01
                </h3>

                {infoList.length === 0 ? (
                  <p className="text-center py-8 text-slate-500 text-base">
                    Belum ada kegiatan atau informasi lingkungan yang dipublikasikan.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {infoList.map((info) => (
                      <div
                        key={info.id}
                        className="p-5 rounded-2xl bg-white/85 hover:bg-white border border-emerald-900/5 flex flex-col justify-between gap-3 transition-all"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                              {info.kategori}
                            </span>
                            {session && (
                              <button
                                onClick={() => handleHapusInfo(info.id)}
                                className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <h4 className="font-extrabold text-emerald-950 text-lg">
                            {info.judul}
                          </h4>
                          <p className="text-sm font-bold text-emerald-700 flex items-center gap-1.5 mt-1.5">
                            <Calendar className="w-4 h-4 shrink-0" />
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span>{info.jadwal_atau_lokasi}</span>
                          </p>
                          <p className="text-sm md:text-base text-slate-600 mt-2 leading-relaxed">
                            {info.deskripsi}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* MODAL LOGIN PENGURUS */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-100"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-emerald-950">Masuk Pengurus RT</h3>
              <button
                onClick={() => setShowLoginModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Khusus Ketua RT dan Bendahara untuk mencatat kas, iuran, serta kegiatan lingkungan.
            </p>

            {authError && (
              <div className="p-3 mb-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
                {authError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Email Pengurus</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="bendahara@rt01.id"
                  className="w-full h-12 px-4 rounded-2xl border border-emerald-200 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Kata Sandi</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 px-4 rounded-2xl border border-emerald-200 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all text-base cursor-pointer"
              >
                {authLoading ? 'Memproses...' : 'Masuk Sekarang'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}