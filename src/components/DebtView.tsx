import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  DebtProfile,
  DebtTransactionType,
  NumeralSystem,
} from '../types/finance';
import { formatCurrency } from '../utils/formatters';
import { ConfirmDialog, ModalSheet } from './ModalSheet';

interface DebtViewProps {
  profiles: DebtProfile[];
  debtSummary: {
    totalDebt: number;
    totalCredit: number;
    netPosition: number;
    profileCount: number;
  };
  numerals: NumeralSystem;
  onAddProfile: (payload: { name: string; phone: string; address: string }) => number;
  onUpdateProfile: (
    profileId: number,
    payload: { name: string; phone: string; address: string }
  ) => void;
  onDeleteProfile: (profileId: number) => void;
  onAddTransaction: (
    profileId: number,
    payload: { type: DebtTransactionType; amount: number; note: string }
  ) => void;
  onDeleteTransaction: (profileId: number, txId: number) => void;
  onSettleProfile: (profileId: number) => void;
}

export function DebtView({
  profiles,
  debtSummary,
  numerals,
  onAddProfile,
  onUpdateProfile,
  onDeleteProfile,
  onAddTransaction,
  onDeleteTransaction,
  onSettleProfile,
}: DebtViewProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(
    () => (profiles.length > 0 ? profiles[0].id : null)
  );
  const [mobileDetailOpen, setMobileDetailOpen] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'all' | 'credit' | 'debt'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  const [editingProfile, setEditingProfile] = useState<DebtProfile | null>(null);
  const [pName, setPName] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pAddress, setPAddress] = useState('');
  const [pError, setPError] = useState('');

  const [txModalOpen, setTxModalOpen] = useState<boolean>(false);
  const [txType, setTxType] = useState<DebtTransactionType>('credit');
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txError, setTxError] = useState('');

  const [deletingProfile, setDeletingProfile] = useState<DebtProfile | null>(null);
  const [deletingTxInfo, setDeletingTxInfo] = useState<{
    profileId: number;
    txId: number;
    label: string;
  } | null>(null);
  const [settlingProfile, setSettlingProfile] = useState<DebtProfile | null>(null);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return profiles.filter((p) => {
      const net = p.credit - p.debt;
      if (filterMode === 'credit' && net <= 0) return false;
      if (filterMode === 'debt' && net >= 0) return false;
      if (q) {
        return (
          p.name.toLowerCase().includes(q) ||
          (p.phone || '').toLowerCase().includes(q) ||
          (p.address || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [profiles, filterMode, searchQuery]);

  const activeProfile = useMemo(() => {
    if (!selectedProfileId) return profiles[0] || null;
    return (
      profiles.find((p) => p.id === selectedProfileId) || profiles[0] || null
    );
  }, [profiles, selectedProfileId]);

  const openCreateProfileModal = () => {
    setEditingProfile(null);
    setPName('');
    setPPhone('');
    setPAddress('');
    setPError('');
    setProfileModalOpen(true);
  };

  const openEditProfileModal = (profile: DebtProfile) => {
    setEditingProfile(profile);
    setPName(profile.name);
    setPPhone(profile.phone || '');
    setPAddress(profile.address || '');
    setPError('');
    setProfileModalOpen(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) {
      setPError('নাম লিখুন');
      return;
    }
    if (editingProfile) {
      onUpdateProfile(editingProfile.id, {
        name: pName,
        phone: pPhone,
        address: pAddress,
      });
    } else {
      const newId = onAddProfile({
        name: pName,
        phone: pPhone,
        address: pAddress,
      });
      setSelectedProfileId(newId);
      setMobileDetailOpen(true);
    }
    setProfileModalOpen(false);
  };

  const openAddTxModal = (defaultType: DebtTransactionType = 'credit') => {
    setTxType(defaultType);
    setTxAmount('');
    setTxNote('');
    setTxError('');
    setTxModalOpen(true);
  };

  const handleSaveTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile) return;
    const normalized = txAmount.replace(/[০-৯]/g, (d) =>
      String('০১২৩৪৫৬৭৮৯'.indexOf(d))
    );
    const val = parseFloat(normalized);
    if (!val || val <= 0 || Number.isNaN(val)) {
      setTxError('সঠিক পরিমাণ লিখুন');
      return;
    }
    onAddTransaction(activeProfile.id, {
      type: txType,
      amount: val,
      note: txNote.trim() || (txType === 'credit' ? 'পাওনা' : 'দেনা'),
    });
    setTxModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Clean Header & Summary */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          দেনা-পাওনা
        </h1>
        <button
          type="button"
          onClick={openCreateProfileModal}
          className="min-h-[42px] px-4 rounded-2xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" />
          <span>নতুন প্রোফাইল</span>
        </button>
      </div>

      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5">
        <div className="grid grid-cols-2 gap-4 divide-x divide-slate-100 dark:divide-slate-800">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">মোট পাওনা</p>
            <p className="font-num mt-1 text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(debtSummary.totalCredit, numerals)}
            </p>
          </div>
          <div className="pl-4 sm:pl-6">
            <p className="text-xs text-slate-400 dark:text-slate-500">মোট দেনা</p>
            <p className="font-num mt-1 text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">
              {formatCurrency(debtSummary.totalDebt, numerals)}
            </p>
          </div>
        </div>
      </section>

      {/* Master-Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Profile List */}
        <section
          className={`lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 ${
            mobileDetailOpen && activeProfile ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/90 mb-3">
            {(
              [
                { id: 'all', label: 'সবাই' },
                { id: 'credit', label: 'পাওনা' },
                { id: 'debt', label: 'দেনা' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-semibold transition-colors ${
                  filterMode === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="নাম খুঁজুন..."
              className="w-full min-h-[40px] pl-9 pr-8 py-1.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {filteredProfiles.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-400">কোনো প্রোফাইল নেই</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredProfiles.map((profile) => {
                const net = profile.credit - profile.debt;
                const isSelected = activeProfile?.id === profile.id;
                const initial = profile.name.trim().charAt(0) || 'প্র';

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => {
                      setSelectedProfileId(profile.id);
                      setMobileDetailOpen(true);
                    }}
                    className={`w-full min-h-[62px] py-3 px-2.5 -mx-2.5 rounded-2xl flex items-center justify-between gap-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-slate-100/90 dark:bg-slate-800/80'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm flex items-center justify-center shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {profile.name}
                        </p>
                        {profile.phone && (
                          <p className="font-num text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                            {profile.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={`font-num text-sm font-bold ${
                          net > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : net < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {formatCurrency(Math.abs(net), numerals)}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {net > 0 ? 'পাওনা' : net < 0 ? 'দেনা' : 'সমান'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Active Profile Ledger */}
        <section
          className={`lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6 ${
            mobileDetailOpen && activeProfile ? 'block' : 'hidden lg:block'
          }`}
        >
          {!activeProfile ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-400">প্রোফাইল নির্বাচন করুন</p>
            </div>
          ) : (
            <div>
              <div className="lg:hidden mb-3">
                <button
                  type="button"
                  onClick={() => setMobileDetailOpen(false)}
                  className="min-h-[40px] -ml-1 px-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>ফিরে যান</span>
                </button>
              </div>

              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {activeProfile.name}
                  </h2>
                  {(activeProfile.phone || activeProfile.address) && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      {activeProfile.phone && (
                        <a
                          href={`tel:${activeProfile.phone}`}
                          className="font-num inline-flex items-center gap-1 hover:text-emerald-600"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{activeProfile.phone}</span>
                        </a>
                      )}
                      {activeProfile.phone && activeProfile.address && <span>·</span>}
                      {activeProfile.address && <span>{activeProfile.address}</span>}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditProfileModal(activeProfile)}
                    aria-label="সম্পাদনা"
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingProfile(activeProfile)}
                    aria-label="মুছুন"
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Net Balance Row */}
              <div className="grid grid-cols-3 gap-3 py-4 border-b border-slate-100 dark:border-slate-800/80">
                <div>
                  <p className="text-xs text-slate-400">পাওনা</p>
                  <p className="font-num mt-0.5 text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(activeProfile.credit, numerals)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">দেনা</p>
                  <p className="font-num mt-0.5 text-base font-bold text-rose-600 dark:text-rose-400">
                    {formatCurrency(activeProfile.debt, numerals)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">নিট</p>
                  <p className="font-num mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                    {formatCurrency(
                      Math.abs(activeProfile.credit - activeProfile.debt),
                      numerals
                    )}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2.5 py-4 border-b border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => openAddTxModal('credit')}
                  className="min-h-[44px] flex-1 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>পাওনা দিলাম</span>
                </button>
                <button
                  type="button"
                  onClick={() => openAddTxModal('debt')}
                  className="min-h-[44px] flex-1 px-4 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>দেনা নিলাম</span>
                </button>

                {Math.abs(activeProfile.credit - activeProfile.debt) > 0.01 && (
                  <button
                    type="button"
                    onClick={() => setSettlingProfile(activeProfile)}
                    className="min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>পরিশোধ</span>
                  </button>
                )}
              </div>

              {/* History */}
              <div className="pt-2">
                {activeProfile.transactions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">
                    কোনো লেনদেন নেই
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {[...activeProfile.transactions].reverse().map((t) => (
                      <div
                        key={t.id}
                        className="min-h-[56px] py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {t.note || (t.type === 'credit' ? 'পাওনা' : 'দেনা')}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {t.type === 'credit' ? 'পাওনা' : 'দেনা'} · {t.time}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`font-num text-sm font-bold ${
                              t.type === 'credit'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {t.type === 'credit' ? '+' : '−'}
                            {formatCurrency(t.amount, numerals)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setDeletingTxInfo({
                                profileId: activeProfile.id,
                                txId: t.id,
                                label: formatCurrency(t.amount, numerals),
                              })
                            }
                            aria-label="মুছুন"
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Modals */}
      <ModalSheet
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title={editingProfile ? 'প্রোফাইল সম্পাদনা' : 'নতুন প্রোফাইল'}
        maxWidthClass="sm:max-w-md"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <input
            type="text"
            value={pName}
            onChange={(e) => {
              setPName(e.target.value);
              if (pError) setPError('');
            }}
            placeholder="নাম *"
            autoFocus
            className="w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-sm"
          />
          <input
            type="tel"
            value={pPhone}
            onChange={(e) => setPPhone(e.target.value)}
            placeholder="মোবাইল নম্বর"
            className="font-num w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-sm"
          />
          <input
            type="text"
            value={pAddress}
            onChange={(e) => setPAddress(e.target.value)}
            placeholder="ঠিকানা বা নোট"
            className="w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-sm"
          />
          {pError && <p className="text-xs text-rose-600">{pError}</p>}
          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl text-sm font-semibold text-white bg-slate-900 dark:bg-emerald-600"
          >
            সংরক্ষণ করুন
          </button>
        </form>
      </ModalSheet>

      <ModalSheet
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        title="নতুন লেনদেন"
        maxWidthClass="sm:max-w-md"
      >
        <form onSubmit={handleSaveTx} className="space-y-4">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setTxType('credit')}
              className={`min-h-[40px] rounded-xl text-xs font-semibold ${
                txType === 'credit'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              পাওনা (দিলাম)
            </button>
            <button
              type="button"
              onClick={() => setTxType('debt')}
              className={`min-h-[40px] rounded-xl text-xs font-semibold ${
                txType === 'debt'
                  ? 'bg-white dark:bg-slate-900 text-rose-600 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              দেনা (নিলাম)
            </button>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={txAmount}
            onChange={(e) => {
              setTxAmount(e.target.value);
              if (txError) setTxError('');
            }}
            placeholder="৳ পরিমাণ"
            autoFocus
            className="font-num w-full min-h-[54px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-2xl font-bold"
          />
          <input
            type="text"
            value={txNote}
            onChange={(e) => setTxNote(e.target.value)}
            placeholder="বিবরণ (ঐচ্ছিক)"
            className="w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-sm"
          />
          {txError && <p className="text-xs text-rose-600">{txError}</p>}
          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl text-sm font-semibold text-white bg-slate-900 dark:bg-emerald-600"
          >
            সংরক্ষণ করুন
          </button>
        </form>
      </ModalSheet>

      <ConfirmDialog
        open={Boolean(deletingProfile)}
        title="প্রোফাইল মুছবেন?"
        description={deletingProfile ? `"${deletingProfile.name}" মুছে ফেলা হবে।` : ''}
        onConfirm={() => {
          if (deletingProfile) {
            onDeleteProfile(deletingProfile.id);
            if (selectedProfileId === deletingProfile.id) {
              setSelectedProfileId(null);
              setMobileDetailOpen(false);
            }
          }
        }}
        onCancel={() => setDeletingProfile(null)}
      />

      <ConfirmDialog
        open={Boolean(deletingTxInfo)}
        title="লেনদেন মুছবেন?"
        description={deletingTxInfo ? `${deletingTxInfo.label} হিসাবটি মুছে ফেলা হবে।` : ''}
        onConfirm={() => {
          if (deletingTxInfo) {
            onDeleteTransaction(deletingTxInfo.profileId, deletingTxInfo.txId);
          }
        }}
        onCancel={() => setDeletingTxInfo(null)}
      />

      <ConfirmDialog
        open={Boolean(settlingProfile)}
        title="হিসাব সমান করবেন?"
        description={
          settlingProfile
            ? `"${settlingProfile.name}"-এর বকেয়া পরিশোধ হিসেবে সমন্বয় হবে।`
            : ''
        }
        confirmLabel="পরিশোধ সম্পন্ন"
        danger={false}
        onConfirm={() => {
          if (settlingProfile) onSettleProfile(settlingProfile.id);
        }}
        onCancel={() => setSettlingProfile(null)}
      />
    </div>
  );
}
