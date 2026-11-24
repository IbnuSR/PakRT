import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import {
  Wallet, ArrowUpCircle, ArrowDownCircle, Users,
  ShieldCheck, PlusCircle, CheckCircle2, Clock, FileText,
  LogIn, LogOut, UserPlus, Search, X, Calendar, MapPin,
  Download, Trash2, Sparkles
} from 'lucide-react';

export default function App() {
  // Autentikasi Pengurus
  const [session, setSession] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Data Utama
  const [transactions, setTransactions] = useState([]);
  const [wargaList, setWargaList] = useState([]);
  const [infoList, setInfoList] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Navigasi & Filter
  const [activeTab, setActiveTab] = useState('kas'); // 'kas' | 'iuran' | 'info'
  const [filterBulan, setFilterBulan] = useState('ALL'); // 'ALL' atau 'YYYY-MM'
  const [searchWarga, setSearchWarga] = useState('');

  // Form Kas
  const [keterangan, setKeterangan] = useState('');
  const [nominal, setNominal] = useState('');
  const [tipe, setTipe] = useState('masuk');

  // Form Warga
  const [namaKK, setNamaKK] = useState('');
  const [nomorRumah, setNomorRumah] = useState('');
  const [nominalIuran, setNominalIuran] = useState('50000');

  // Form Info & Kegiatan Lingkungan
  const [kategoriInfo, setKategoriInfo] = useState('Kegiatan');
  const [judulInfo, setJudulInfo] = useState('');
  const [lokasiJadwal, setLokasiJadwal] = useState('');
  const [deskripsiInfo, setDeskripsiInfo] = useState('');

  // 1. Cek Sesi Login
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

  // 2. Fetch Data Awal & Real-Time Subscription
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
      .channel('pakrt-full-realtime')
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

  // Daftar Bulan Unik untuk Laporan Kas
  const bulanOptions = useMemo(() => {
    const setBulan = new Set(
      transactions.map((t) => (t.tanggal ? t.tanggal.slice(0, 7) : '')).filter(Boolean)
    );
    return Array.from(setBulan).sort().reverse();
  }, [transactions]);

  // Transaksi Terfilter per Bulan
  const filteredTransactions = useMemo(() => {
    if (filterBulan === 'ALL') return transactions;
    return transactions.filter((t) => (t.tanggal || '').startsWith(filterBulan));
  }, [transactions, filterBulan]);

  // Kalkulasi Saldo Keseluruhan & Laporan Periode Terpilih
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

  // Statistik Iuran Warga
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

  // Cetak Laporan Kas ke File Excel (.xlsx)
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

  // Handler Login
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

  // Handler Tambah Transaksi
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

  // Handler Tambah Warga
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

  // Handler Tandai Lunas + Otomatis Masuk Kas
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

  // Handler Tambah Info & Kegiatan Lingkungan
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

  return (
    <div className="min-h-screen pb-20">
      {/* NAVBAR */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-emerald-100">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: [0, -6, 6, 0] }}
              transition={{ duration: 0.4 }}
              className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20"
            >
              <ShieldCheck className="w-6 h-6" />
            </motion.div>
            <div>
              <h1 className="text-xl font-extrabold text-emerald-950 tracking-tight leading-none">
                PakRT
              </h1>
              <p className="text-xs md:text-sm text-emerald-700 font-medium mt-1">
                Kas, Kegiatan & Info Lingkungan RT 01
              </p>
            </div>
          </div>

          {session ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg">
                Mode Pengurus Aktif
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-sm border border-rose-200 transition-all"
              >
                <LogOut className="w-4 h-4" /> Keluar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all"
            >
              <LogIn className="w-4 h-4" /> Login Pengurus
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        {/* KARTU UTAMA SALDO KAS */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="glass-card p-6 md:p-8 relative overflow-hidden"
        >
          <div className="absolute -right-10 -top-10 w-44 h-44 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-3">
                <Wallet className="w-4 h-4" /> Saldo Kas RT 01 Saat Ini
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-emerald-950 tracking-tight">
                {loadingData ? 'Memuat...' : formatRupiah(saldoAkhir)}
              </h2>
              <p className="text-sm md:text-base text-slate-600 mt-2">
                Transparan untuk semua warga dan sinkron otomatis di Web & HP.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-[280px]">
              <div className="bg-emerald-50/90 border border-emerald-200/80 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm mb-1">
                  <ArrowUpCircle className="w-5 h-5" /> Total Pemasukan
                </div>
                <p className="text-lg md:text-xl font-bold text-emerald-900">
                  {formatRupiah(totalMasuk)}
                </p>
              </div>

              <div className="bg-rose-50/80 border border-rose-200/70 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm mb-1">
                  <ArrowDownCircle className="w-5 h-5" /> Total Pengeluaran
                </div>
                <p className="text-lg md:text-xl font-bold text-rose-900">
                  {formatRupiah(totalKeluar)}
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* NAVIGASI 3 TAB BESAR (RAMAH SEMUA USIA) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setActiveTab('kas')}
            className={`h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all border ${
              activeTab === 'kas'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20'
                : 'bg-white/80 text-emerald-950 border-white hover:bg-white'
            }`}
          >
            <FileText className="w-5 h-5" /> Kas & Laporan Excel
          </button>

          <button
            onClick={() => setActiveTab('iuran')}
            className={`h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all border ${
              activeTab === 'iuran'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20'
                : 'bg-white/80 text-emerald-950 border-white hover:bg-white'
            }`}
          >
            <Users className="w-5 h-5" /> Iuran Warga ({statsIuran.lunas}/{statsIuran.total})
          </button>

          <button
            onClick={() => setActiveTab('info')}
            className={`h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all border ${
              activeTab === 'info'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20'
                : 'bg-white/80 text-emerald-950 border-white hover:bg-white'
            }`}
          >
            <Sparkles className="w-5 h-5" /> Kegiatan & Info RT ({infoList.length})
          </button>
        </div>

        {/* KONTEN ANIMASI PER TAB */}
        <AnimatePresence mode="wait">
          {/* ================= TAB 1: KAS & LAPORAN EXCEL ================= */}
          {activeTab === 'kas' && (
            <motion.div
              key="tab-kas"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {session && (
                <section className="glass-card p-6 border-2 border-emerald-400/60 bg-white/90">
                  <h3 className="text-lg md:text-xl font-bold text-emerald-950 flex items-center gap-2 mb-4">
                    <PlusCircle className="w-6 h-6 text-emerald-600" />
                    Catat Pemasukan / Pengeluaran Kas
                  </h3>

                  <form onSubmit={handleTambahTransaksi} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jenis</label>
                      <select
                        value={tipe}
                        onChange={(e) => setTipe(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-emerald-200 bg-white text-base font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="masuk">Uang Masuk (+)</option>
                        <option value="keluar">Uang Keluar (-)</option>
                      </select>
                    </div>

                    <div className="md:col-span-5">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Keterangan</label>
                      <input
                        type="text"
                        placeholder="Contoh: Sumbangan / Perbaikan Lampu"
                        value={keterangan}
                        onChange={(e) => setKeterangan(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-emerald-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nominal (Rp)</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="50000"
                          value={nominal}
                          onChange={(e) => setNominal(e.target.value)}
                          className="w-full h-12 px-4 rounded-xl border border-emerald-200 bg-white text-base font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                        <button
                          type="submit"
                          className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all shrink-0"
                        >
                          Simpan
                        </button>
                      </div>
                    </div>
                  </form>
                </section>
              )}

              {/* KARTU LAPORAN KAS & CETAK EXCEL */}
              <section className="glass-card p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-100 pb-4">
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-emerald-950">
                      Laporan & Mutasi Kas
                    </h3>
                    <p className="text-sm text-slate-600">
                      Periode: <span className="font-bold text-emerald-800">{filterBulan === 'ALL' ? 'Semua Bulan' : filterBulan}</span> • Masuk: <span className="font-semibold text-emerald-700">{formatRupiah(laporanPeriode.masuk)}</span> • Keluar: <span className="font-semibold text-rose-600">{formatRupiah(laporanPeriode.keluar)}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <select
                      value={filterBulan}
                      onChange={(e) => setFilterBulan(e.target.value)}
                      className="h-12 px-4 rounded-xl border border-emerald-200 bg-white text-sm font-bold text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="ALL">Semua Bulan</option>
                      {bulanOptions.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>

                    <button
                      onClick={handleExportExcel}
                      className="h-12 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Download className="w-4 h-4" /> Cetak Excel (.xlsx)
                    </button>
                  </div>
                </div>

                {filteredTransactions.length === 0 ? (
                  <p className="text-center py-8 text-slate-500 text-base">
                    Belum ada catatan transaksi kas pada periode ini.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredTransactions.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-white/85 border border-emerald-100"
                      >
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
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
                            <p className="font-bold text-slate-800 text-base md:text-lg leading-snug">
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {session && (
                <section className="glass-card p-6 border-2 border-emerald-400/60 bg-white/90">
                  <h3 className="text-lg md:text-xl font-bold text-emerald-950 flex items-center gap-2 mb-4">
                    <UserPlus className="w-6 h-6 text-emerald-600" />
                    Tambah Data Kepala Keluarga (KK)
                  </h3>

                  <form onSubmit={handleTambahWarga} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-5">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Kepala Keluarga</label>
                      <input
                        type="text"
                        placeholder="Contoh: Bpk. Ahmad Sutrisno"
                        value={namaKK}
                        onChange={(e) => setNamaKK(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-emerald-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">No. Rumah / Blok</label>
                      <input
                        type="text"
                        placeholder="Contoh: A-01"
                        value={nomorRumah}
                        onChange={(e) => setNomorRumah(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-emerald-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Iuran Bulanan (Rp)</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={nominalIuran}
                          onChange={(e) => setNominalIuran(e.target.value)}
                          className="w-full h-12 px-4 rounded-xl border border-emerald-200 bg-white text-base font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                        <button
                          type="submit"
                          className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all shrink-0"
                        >
                          Tambah
                        </button>
                      </div>
                    </div>
                  </form>
                </section>
              )}

              <section className="glass-card p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-emerald-950">
                      Daftar Iuran Bulanan Warga
                    </h3>
                    <p className="text-sm text-slate-600">
                      Terkumpul {statsIuran.lunas} dari {statsIuran.total} KK ({statsIuran.persen}%)
                    </p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      placeholder="Cari nama / no rumah..."
                      value={searchWarga}
                      onChange={(e) => setSearchWarga(e.target.value)}
                      className="w-full h-12 pl-11 pr-4 rounded-xl border border-emerald-200 bg-white/90 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {filteredWarga.length === 0 ? (
                  <p className="text-center py-8 text-slate-500 text-base">
                    Data warga belum tersedia atau tidak ditemukan.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredWarga.map((warga) => (
                      <div
                        key={warga.id}
                        className="p-4 rounded-xl bg-white/85 border border-emerald-100 flex items-center justify-between gap-3"
                      >
                        <div>
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                            Rumah {warga.nomor_rumah}
                          </span>
                          <h4 className="font-bold text-slate-900 text-base md:text-lg mt-1">
                            {warga.nama_kk}
                          </h4>
                          <p className="text-sm text-slate-600 font-medium">
                            Tagihan: {formatRupiah(warga.nominal_iuran)}
                          </p>
                        </div>

                        {warga.status_lunas ? (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-sm shrink-0">
                            <CheckCircle2 className="w-4 h-4" /> Lunas
                          </span>
                        ) : session ? (
                          <button
                            onClick={() => handleTandaiLunas(warga)}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-all shrink-0"
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {session && (
                <section className="glass-card p-6 border-2 border-emerald-400/60 bg-white/90">
                  <h3 className="text-lg md:text-xl font-bold text-emerald-950 flex items-center gap-2 mb-4">
                    <PlusCircle className="w-6 h-6 text-emerald-600" />
                    Tambah Kegiatan atau Info Lingkungan RT
                  </h3>

                  <form onSubmit={handleTambahInfo} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kategori</label>
                      <select
                        value={kategoriInfo}
                        onChange={(e) => setKategoriInfo(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-emerald-200 bg-white text-base font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Kegiatan">Kegiatan</option>
                        <option value="Info Lingkungan">Info Lingkungan</option>
                        <option value="Pengumuman">Pengumuman</option>
                      </select>
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Judul</label>
                      <input
                        type="text"
                        placeholder="Contoh: Kerja Bakti / Pos Kamling"
                        value={judulInfo}
                        onChange={(e) => setJudulInfo(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-emerald-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-5">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jadwal / Lokasi</label>
                      <input
                        type="text"
                        placeholder="Contoh: Minggu 07.00 WIB • Balai RT 01"
                        value={lokasiJadwal}
                        onChange={(e) => setLokasiJadwal(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-emerald-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    <div className="md:col-span-12 flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        placeholder="Penjelasan singkat agar mudah dipahami semua warga..."
                        value={deskripsiInfo}
                        onChange={(e) => setDeskripsiInfo(e.target.value)}
                        className="flex-1 h-12 px-4 rounded-xl border border-emerald-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                      <button
                        type="submit"
                        className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all shrink-0"
                      >
                        Publikasikan
                      </button>
                    </div>
                  </form>
                </section>
              )}

              <section className="glass-card p-6 space-y-4">
                <h3 className="text-lg md:text-xl font-bold text-emerald-950">
                  Informasi & Kegiatan Lingkungan RT 01
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
                        className="p-5 rounded-2xl bg-white/90 border border-emerald-100 flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                              {info.kategori}
                            </span>
                            {session && (
                              <button
                                onClick={() => handleHapusInfo(info.id)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-all"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <h4 className="font-extrabold text-emerald-950 text-lg">
                            {info.judul}
                          </h4>
                          <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5 mt-1">
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-emerald-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-emerald-950">Login Pengurus RT</h3>
              <button
                onClick={() => setShowLoginModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Khusus Ketua RT dan Bendahara untuk mengelola kas, iuran, serta kegiatan lingkungan.
            </p>

            {authError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
                {authError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email Pengurus</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="bendahara@rt01.id"
                  className="w-full h-12 px-4 rounded-xl border border-emerald-200 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Kata Sandi</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 px-4 rounded-xl border border-emerald-200 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all text-base"
              >
                {authLoading ? 'Memproses...' : 'Masuk Sekarang'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}