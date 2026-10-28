import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Download,
  FileDown,
  FolderPlus,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { ContactItem, NumeralSystem } from '../types/finance';
import { markExternalPickerOpen } from '../utils/crypto';
import {
  ContactGroupMap,
  compressAvatarFile,
  exportContactsJson,
  importContactsJson,
  listAllContacts,
  loadContactGroups,
  removeContact,
  saveContactGroups,
  upsertContact,
} from '../utils/contactsDb';
import { formatNumber } from '../utils/formatters';
import { generateContactsDirectoryPdf } from '../utils/pdfExporter';
import { ConfirmDialog, ModalSheet } from './ModalSheet';

interface ContactsViewProps {
  numerals: NumeralSystem;
  onBack: () => void;
  onNotify: (msg: string, tone?: 'neutral' | 'success' | 'danger') => void;
}

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export function ContactsView({
  numerals,
  onBack,
  onNotify,
}: ContactsViewProps) {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [groups, setGroups] = useState<ContactGroupMap>(() =>
    loadContactGroups()
  );
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedSubGroup, setSelectedSubGroup] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  // Add / Edit Contact Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactItem | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<ContactItem | null>(null);

  // Group / Sub-group creation modal
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newSubGroupName, setNewSubGroupName] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [formGroup, setFormGroup] = useState('পরিবার');
  const [formSubGroup, setFormSubGroup] = useState('আত্মীয়');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(
    undefined
  );
  const [formError, setFormError] = useState('');

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const jsonImportRef = useRef<HTMLInputElement | null>(null);

  const refreshContacts = useCallback(async () => {
    try {
      const list = await listAllContacts();
      setContacts(list);
    } catch {
      onNotify('কন্টাক্ট লোড করা যায়নি', 'danger');
    }
  }, [onNotify]);

  useEffect(() => {
    void refreshContacts();
    const onUpdated = () => {
      setGroups(loadContactGroups());
      void refreshContacts();
    };
    window.addEventListener('amar-hisab-contacts-updated', onUpdated);
    return () =>
      window.removeEventListener('amar-hisab-contacts-updated', onUpdated);
  }, [refreshContacts]);

  const groupNames = useMemo(() => Object.keys(groups), [groups]);

  const availableSubGroupsForFilter = useMemo(() => {
    if (selectedGroup === 'ALL') return [];
    return groups[selectedGroup] || [];
  }, [groups, selectedGroup]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (selectedGroup !== 'ALL' && c.group !== selectedGroup) return false;
      if (selectedSubGroup !== 'ALL' && c.subGroup !== selectedSubGroup)
        return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.secondaryPhone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.organization || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q) ||
        (c.bloodGroup || '').toLowerCase().includes(q)
      );
    });
  }, [contacts, selectedGroup, selectedSubGroup, search]);

  const openCreateModal = () => {
    const defaultG =
      selectedGroup !== 'ALL' ? selectedGroup : groupNames[0] || 'পরিবার';
    const defaultSubs = groups[defaultG] || ['সাধারণ'];
    const defaultSg =
      selectedSubGroup !== 'ALL' && defaultSubs.includes(selectedSubGroup)
        ? selectedSubGroup
        : defaultSubs[0] || 'সাধারণ';

    setEditingContact(null);
    setName('');
    setPhone('');
    setSecondaryPhone('');
    setEmail('');
    setOrganization('');
    setBloodGroup('');
    setAddress('');
    setNotes('');
    setFormGroup(defaultG);
    setFormSubGroup(defaultSg);
    setPhotoDataUrl(undefined);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (c: ContactItem) => {
    setEditingContact(c);
    setName(c.name);
    setPhone(c.phone);
    setSecondaryPhone(c.secondaryPhone || '');
    setEmail(c.email || '');
    setOrganization(c.organization || '');
    setBloodGroup(c.bloodGroup || '');
    setAddress(c.address || '');
    setNotes(c.notes || '');
    setFormGroup(c.group || groupNames[0] || 'পরিবার');
    setFormSubGroup(c.subGroup || 'সাধারণ');
    setPhotoDataUrl(c.photoDataUrl);
    setFormError('');
    setModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressAvatarFile(file);
      setPhotoDataUrl(dataUrl);
    } catch {
      onNotify('ছবি প্রসেস করা যায়নি', 'danger');
    }
    e.target.value = '';
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('নাম লিখুন');
      return;
    }
    if (!phone.trim()) {
      setFormError('মোবাইল নম্বর লিখুন');
      return;
    }

    const g = formGroup.trim() || 'পরিবার';
    const sg = formSubGroup.trim() || 'সাধারণ';

    // Ensure group & subGroup exist in map
    const nextGroups: ContactGroupMap = { ...groups };
    if (!nextGroups[g]) nextGroups[g] = [];
    if (!nextGroups[g].includes(sg)) {
      nextGroups[g] = [...nextGroups[g], sg];
      setGroups(nextGroups);
      saveContactGroups(nextGroups);
    }

    const item: ContactItem = {
      id: editingContact
        ? editingContact.id
        : `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      phone: phone.trim(),
      secondaryPhone: secondaryPhone.trim() || undefined,
      email: email.trim() || undefined,
      organization: organization.trim() || undefined,
      bloodGroup: bloodGroup || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      group: g,
      subGroup: sg,
      photoDataUrl,
      createdAt: editingContact ? editingContact.createdAt : Date.now(),
    };

    await upsertContact(item);
    await refreshContacts();
    setModalOpen(false);
    onNotify(
      editingContact ? 'কন্টাক্ট আপডেট হয়েছে' : 'কন্টাক্ট সংরক্ষিত হয়েছে',
      'success'
    );
  };

  const handleAddGroupOrSubGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const g = newGroupName.trim();
    const sg = newSubGroupName.trim();
    if (!g) return;

    const nextGroups: ContactGroupMap = { ...groups };
    if (!nextGroups[g]) nextGroups[g] = [];
    if (sg && !nextGroups[g].includes(sg)) {
      nextGroups[g] = [...nextGroups[g], sg];
    } else if (nextGroups[g].length === 0) {
      nextGroups[g] = ['সাধারণ'];
    }

    setGroups(nextGroups);
    saveContactGroups(nextGroups);
    setSelectedGroup(g);
    setSelectedSubGroup(sg || 'ALL');
    setNewGroupName('');
    setNewSubGroupName('');
    setGroupModalOpen(false);
    onNotify('গ্রুপ যুক্ত হয়েছে', 'success');
  };

  const handleDownloadPdf = async () => {
    if (filteredContacts.length === 0) {
      onNotify('ডাউনলোড করার মতো কন্টাক্ট নেই', 'danger');
      return;
    }
    setExportingPdf(true);
    try {
      await generateContactsDirectoryPdf(filteredContacts);
      onNotify('কন্টাক্ট PDF ডাউনলোড হয়েছে', 'success');
    } catch {
      onNotify('PDF তৈরিতে সমস্যা হয়েছে', 'danger');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportJson = async () => {
    if (contacts.length === 0) {
      onNotify('কোনো কন্টাক্ট নেই', 'danger');
      return;
    }
    await exportContactsJson(contacts, groups);
    onNotify('কন্টাক্ট JSON ডাউনলোড হয়েছে', 'success');
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const res = await importContactsJson(reader.result);
        if (res) {
          setGroups(res.groups);
          await refreshContacts();
          onNotify(`${res.importedCount}টি কন্টাক্ট ইমপোর্ট হয়েছে`, 'success');
        } else {
          onNotify('সঠিক কন্টাক্ট JSON ফাইল দিন', 'danger');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formSubGroupOptions = groups[formGroup] || ['সাধারণ'];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[42px] -ml-2 px-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>মোর মেনু</span>
        </button>

        <button
          type="button"
          onClick={openCreateModal}
          className="min-h-[42px] px-4 rounded-2xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন কন্টাক্ট</span>
        </button>
      </div>

      {/* Header + 1-Click PDF & JSON Actions */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-400">কন্টাক্ট বুক</p>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              মোট{' '}
              <span className="font-num text-emerald-600 dark:text-emerald-400">
                {formatNumber(contacts.length, numerals)}
              </span>
              টি নম্বর
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={exportingPdf}
              onClick={() => void handleDownloadPdf()}
              className="min-h-[40px] px-3.5 rounded-2xl bg-[#0B2620] hover:bg-[#12382F] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-300" />
              <span>{exportingPdf ? 'তৈরি হচ্ছে...' : 'PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleExportJson()}
              className="min-h-[40px] px-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>JSON</span>
            </button>

            <button
              type="button"
              onClick={() => {
                markExternalPickerOpen();
                jsonImportRef.current?.click();
              }}
              className="min-h-[40px] px-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>ইমপোর্ট</span>
            </button>
            <input
              ref={jsonImportRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportJsonFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="নাম, ফোন, ঠিকানা বা ব্লাড গ্রুপ খুঁজুন..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 text-sm focus:outline-none focus:border-slate-900 dark:focus:border-emerald-500"
          />
        </div>

        {/* Group Filter Row */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => {
                setSelectedGroup('ALL');
                setSelectedSubGroup('ALL');
              }}
              className={`min-h-[36px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                selectedGroup === 'ALL'
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              সব গ্রুপ
            </button>

            {groupNames.map((g) => {
              const active = selectedGroup === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setSelectedGroup(g);
                    setSelectedSubGroup('ALL');
                  }}
                  className={`min-h-[36px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {g}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setNewGroupName(selectedGroup !== 'ALL' ? selectedGroup : '');
                setNewSubGroupName('');
                setGroupModalOpen(true);
              }}
              className="min-h-[36px] px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>গ্রুপ/সাব-গ্রুপ</span>
            </button>
          </div>

          {/* Sub-group Filter Row */}
          {selectedGroup !== 'ALL' && availableSubGroupsForFilter.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedSubGroup('ALL')}
                className={`min-h-[32px] px-3 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                  selectedSubGroup === 'ALL'
                    ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                সব সাব-গ্রুপ
              </button>
              {availableSubGroupsForFilter.map((sg) => {
                const active = selectedSubGroup === sg;
                return (
                  <button
                    key={sg}
                    type="button"
                    onClick={() => setSelectedSubGroup(sg)}
                    className={`min-h-[32px] px-3 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {sg}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Contact List */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
        {filteredContacts.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <Users className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2.5" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              কোনো কন্টাক্ট পাওয়া যায়নি
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              + নতুন কন্টাক্ট যুক্ত করুন
            </button>
          </div>
        ) : (
          filteredContacts.map((c) => (
            <div
              key={c.id}
              onClick={() => openEditModal(c)}
              className="p-4 sm:px-5 flex items-center gap-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
            >
              {/* Avatar */}
              {c.photoDataUrl ? (
                <img
                  src={c.photoDataUrl}
                  alt={c.name}
                  className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-slate-200/60 dark:border-slate-700"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-[#0B2620] text-emerald-200 font-bold text-base flex items-center justify-center shrink-0">
                  {c.name.trim().charAt(0) || 'ক'}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {c.name}
                  </p>
                  {c.bloodGroup && (
                    <span className="font-num text-[11px] font-bold text-rose-600 dark:text-rose-400 shrink-0">
                      {c.bloodGroup}
                    </span>
                  )}
                </div>

                <p className="font-num text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {c.phone}
                </p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-400">
                  <span>
                    {c.group} · {c.subGroup}
                  </span>
                  {c.address && (
                    <span className="inline-flex items-center gap-1 truncate max-w-[180px]">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{c.address}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Direct Call / Email Actions */}
              <div
                className="flex items-center gap-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    aria-label="ইমেইল পাঠান"
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                )}
                <a
                  href={`tel:${c.phone}`}
                  aria-label="কল করুন"
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))
        )}
      </section>

      {/* Add / Edit Contact Modal */}
      <ModalSheet
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingContact ? 'কন্টাক্ট সম্পাদনা' : 'নতুন কন্টাক্ট'}
      >
        <form onSubmit={handleSaveContact} className="space-y-4">
          {/* Avatar Picker */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                markExternalPickerOpen();
                photoInputRef.current?.click();
              }}
              className="relative w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0"
            >
              {photoDataUrl ? (
                <img
                  src={photoDataUrl}
                  alt="প্রোফাইল"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Camera className="w-5 h-5 text-slate-400" />
              )}
            </button>
            <div>
              <button
                type="button"
                onClick={() => {
                  markExternalPickerOpen();
                  photoInputRef.current?.click();
                }}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {photoDataUrl ? 'ছবি পরিবর্তন করুন' : 'ছবি যুক্ত করুন'}
              </button>
              {photoDataUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(undefined)}
                  className="block text-[11px] text-rose-500 mt-1"
                >
                  ছবি সরান
                </button>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                নাম *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="পূর্ণ নাম"
                className="w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                মোবাইল নম্বর *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="01XXXXXXXXX"
                className="font-num w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
              />
            </div>
          </div>

          {/* Group & Sub-group */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                গ্রুপ
              </label>
              <select
                value={formGroup}
                onChange={(e) => {
                  const nextG = e.target.value;
                  setFormGroup(nextG);
                  const subs = groups[nextG] || ['সাধারণ'];
                  setFormSubGroup(subs[0] || 'সাধারণ');
                }}
                className="w-full min-h-[44px] px-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
              >
                {groupNames.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                সাব-গ্রুপ
              </label>
              <input
                type="text"
                list="contact-subgroups-list"
                value={formSubGroup}
                onChange={(e) => setFormSubGroup(e.target.value)}
                placeholder="সাব-গ্রুপ লিখুন বা বাছুন"
                className="w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
              />
              <datalist id="contact-subgroups-list">
                {formSubGroupOptions.map((sg) => (
                  <option key={sg} value={sg} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                ইমেইল
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.com"
                className="font-num w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                বিকল্প ফোন
              </label>
              <input
                type="tel"
                value={secondaryPhone}
                onChange={(e) => setSecondaryPhone(e.target.value)}
                placeholder="ঐচ্ছিক নম্বর"
                className="font-num w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                প্রতিষ্ঠান / পেশা
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="ঐচ্ছিক"
                className="w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                রক্তের গ্রুপ
              </label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="font-num w-full min-h-[44px] px-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
              >
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg || 'none'} value={bg}>
                    {bg || 'নির্বাচন করুন'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              ঠিকানা
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="বাসা/অফিসের ঠিকানা"
              className="w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              অতিরিক্ত তথ্য / নোট
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="প্রয়োজনীয় নোট..."
              className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
            />
          </div>

          {formError && (
            <p className="text-xs font-medium text-rose-600">{formError}</p>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            {editingContact && (
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setDeleteTarget(editingContact);
                }}
                className="min-h-[48px] px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>মুছুন</span>
              </button>
            )}
            <button
              type="submit"
              className="flex-1 min-h-[48px] rounded-2xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
            >
              সংরক্ষণ করুন
            </button>
          </div>
        </form>
      </ModalSheet>

      {/* Add Group / Sub-group Modal */}
      <ModalSheet
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        title="নতুন গ্রুপ ও সাব-গ্রুপ"
        maxWidthClass="sm:max-w-md"
      >
        <form onSubmit={handleAddGroupOrSubGroup} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              গ্রুপের নাম
            </label>
            <input
              type="text"
              list="existing-groups-datalist"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="যেমন: আত্মীয়, ব্যাংক, গ্রাহক..."
              required
              className="w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
            />
            <datalist id="existing-groups-datalist">
              {groupNames.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              সাব-গ্রুপের নাম (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={newSubGroupName}
              onChange={(e) => setNewSubGroupName(e.target.value)}
              placeholder="যেমন: ঢাকা শাখা, পাইকারি..."
              className="w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full min-h-[46px] rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-sm font-semibold"
          >
            যুক্ত করুন
          </button>
        </form>
      </ModalSheet>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="কন্টাক্ট মুছে ফেলবেন?"
        description={
          deleteTarget ? `"${deleteTarget.name}" ডিরেক্টরি থেকে মুছে যাবে।` : ''
        }
        onConfirm={() => {
          if (deleteTarget) {
            void removeContact(deleteTarget.id).then(() => {
              void refreshContacts();
              onNotify('কন্টাক্ট মুছে ফেলা হয়েছে', 'neutral');
            });
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
