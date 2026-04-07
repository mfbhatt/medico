import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/slices/uiSlice';
import api from '@/services/api';

const TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];

function AccountRow({ account, onEdit, onDelete }: { account: any; onEdit: (a: any) => void; onDelete: (a: any) => void }) {
  const typeColors: Record<string, string> = {
    asset: 'badge-blue', liability: 'badge-red', equity: 'badge-yellow',
    income: 'badge-green', expense: 'badge-gray',
  };
  return (
    <div className="flex items-center justify-between py-2 px-4 hover:bg-gray-50 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-gray-300 text-xs font-mono w-14 text-right">{account.code || '—'}</span>
        <span className="text-gray-800 text-sm">{account.name}</span>
        {account.is_system && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">system</span>}
      </div>
      <div className="flex items-center gap-3">
        <span className={`${typeColors[account.account_type] ?? 'badge-gray'} text-xs`}>{account.account_type}</span>
        {!account.is_system && (
          <div className="flex gap-2">
            <button onClick={() => onEdit(account)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
            <button onClick={() => onDelete(account)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupNode({ group, accounts, allGroups, onAddAccount, onEditGroup, onDeleteGroup, onEditAccount, onDeleteAccount }: any) {
  const [open, setOpen] = useState(true);
  const groupAccounts = accounts.filter((a: any) => a.account_group_id === group.id);

  return (
    <div className="mb-1">
      <div
        className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer select-none
          ${group.nature === 'dr' ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'}`}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <span>{open ? '▾' : '▸'}</span>
          {group.name}
          <span className="text-xs font-normal opacity-60">({group.nature.toUpperCase()})</span>
        </div>
        {!group.is_system && (
          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => onEditGroup(group)} className="text-xs opacity-70 hover:opacity-100">Edit</button>
            <button onClick={() => onDeleteGroup(group)} className="text-xs opacity-70 hover:opacity-100">Delete</button>
          </div>
        )}
      </div>

      {open && (
        <div className="ml-4 mt-1 border-l-2 border-gray-200 pl-2">
          {/* Child groups */}
          {allGroups
            .filter((g: any) => g.parent_id === group.id)
            .map((child: any) => (
              <GroupNode
                key={child.id}
                group={child}
                accounts={accounts}
                allGroups={allGroups}
                onAddAccount={onAddAccount}
                onEditGroup={onEditGroup}
                onDeleteGroup={onDeleteGroup}
                onEditAccount={onEditAccount}
                onDeleteAccount={onDeleteAccount}
              />
            ))}

          {/* Accounts */}
          {groupAccounts.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-100 mt-1">
              {groupAccounts.map((a: any) => (
                <AccountRow key={a.id} account={a} onEdit={onEditAccount} onDelete={onDeleteAccount} />
              ))}
            </div>
          )}

          <button
            onClick={() => onAddAccount(group)}
            className="mt-1 text-xs text-gray-400 hover:text-primary-600 flex items-center gap-1 px-2 py-1"
          >
            + Add account
          </button>
        </div>
      )}
    </div>
  );
}

export default function ChartOfAccountsPage() {
  const dispatch = useDispatch();
  const qc = useQueryClient();

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editAccount, setEditAccount] = useState<any>(null);
  const [editGroup, setEditGroup] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const toast = {
    success: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'success', message: m, duration: 3000 })),
    error: (m: string) => dispatch(addToast({ id: Date.now().toString(), type: 'error', message: m, duration: 5000 })),
  };

  const { data: groupsData } = useQuery({
    queryKey: ['accounting', 'groups'],
    queryFn: () => api.get('/accounting/groups').then(r => r.data.data),
  });

  const { data: accountsData } = useQuery({
    queryKey: ['accounting', 'accounts'],
    queryFn: () => api.get('/accounting/accounts', { params: { active_only: false } }).then(r => r.data.data),
  });

  const groups: any[] = groupsData ?? [];
  const accounts: any[] = accountsData ?? [];

  // Flatten the tree structure from the API for our GroupNode components
  const flatGroups: any[] = [];
  const flattenGroups = (nodes: any[], parentId: string | null = null) => {
    for (const node of nodes) {
      flatGroups.push({ ...node, parent_id: parentId });
      if (node.children?.length) flattenGroups(node.children, node.id);
    }
  };
  flattenGroups(groups);
  const rootGroups = flatGroups.filter(g => !g.parent_id);

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editAccount) return api.put(`/accounting/accounts/${editAccount.id}`, data);
      return api.post('/accounting/accounts', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting'] });
      setShowAccountModal(false);
      setEditAccount(null);
      setForm({});
      toast.success(editAccount ? 'Account updated' : 'Account created');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/accounting/accounts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounting'] }); toast.success('Account deleted'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const saveGroupMutation = useMutation({
    mutationFn: (data: any) => {
      if (editGroup) return api.put(`/accounting/groups/${editGroup.id}`, data);
      return api.post('/accounting/groups', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting'] });
      setShowGroupModal(false);
      setEditGroup(null);
      setForm({});
      toast.success(editGroup ? 'Group updated' : 'Group created');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/accounting/groups/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounting'] }); toast.success('Group deleted'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const openAddAccount = (group: any) => {
    setSelectedGroup(group);
    setEditAccount(null);
    setForm({ account_group_id: group.id, account_type: 'asset' });
    setShowAccountModal(true);
  };

  const openEditAccount = (a: any) => {
    setEditAccount(a);
    setForm({ ...a });
    setShowAccountModal(true);
  };

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">Chart of Accounts</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => { setEditGroup(null); setForm({ nature: 'dr' }); setShowGroupModal(true); }}>
            + Add Group
          </button>
          <button className="btn-primary" onClick={() => { setSelectedGroup(null); setEditAccount(null); setForm({}); setShowAccountModal(true); }}>
            + Add Account
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-2">
        {rootGroups.map(g => (
          <GroupNode
            key={g.id}
            group={g}
            accounts={accounts}
            allGroups={flatGroups}
            onAddAccount={openAddAccount}
            onEditGroup={(grp: any) => { setEditGroup(grp); setForm({ ...grp }); setShowGroupModal(true); }}
            onDeleteGroup={(grp: any) => { if (confirm(`Delete group "${grp.name}"?`)) deleteGroupMutation.mutate(grp.id); }}
            onEditAccount={openEditAccount}
            onDeleteAccount={(a: any) => { if (confirm(`Delete account "${a.name}"?`)) deleteAccountMutation.mutate(a.id); }}
          />
        ))}
        {rootGroups.length === 0 && (
          <p className="text-center text-gray-400 py-8 text-sm">Loading chart of accounts…</p>
        )}
      </div>

      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">{editAccount ? 'Edit Account' : 'New Account'}</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Account Name *</label>
                <input className="input" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Code</label>
                  <input className="input" value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. 1001" />
                </div>
                <div>
                  <label className="label">Type *</label>
                  <select className="input" value={form.account_type || 'asset'} onChange={e => setForm({ ...form, account_type: e.target.value })}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {!editAccount && (
                <div>
                  <label className="label">Group *</label>
                  <select className="input" value={form.account_group_id || ''} onChange={e => setForm({ ...form, account_group_id: e.target.value })}>
                    <option value="">Select group</option>
                    {flatGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Opening Balance</label>
                  <input type="number" className="input" value={form.opening_balance || 0} onChange={e => setForm({ ...form, opening_balance: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Balance Type</label>
                  <select className="input" value={form.opening_balance_type || 'dr'} onChange={e => setForm({ ...form, opening_balance_type: e.target.value })}>
                    <option value="dr">Debit</option>
                    <option value="cr">Credit</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="label">Bank Name (for bank accounts)</label>
                <input className="input" value={form.bank_name || ''} onChange={e => setForm({ ...form, bank_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Bank Account Number</label>
                <input className="input" value={form.bank_account_number || ''} onChange={e => setForm({ ...form, bank_account_number: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                className="btn-primary flex-1"
                disabled={saveMutation.isPending || !form.name}
                onClick={() => saveMutation.mutate(form)}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-secondary flex-1" onClick={() => { setShowAccountModal(false); setEditAccount(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-4">{editGroup ? 'Edit Group' : 'New Group'}</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Group Name *</label>
                <input className="input" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Nature *</label>
                <select className="input" value={form.nature || 'dr'} onChange={e => setForm({ ...form, nature: e.target.value })}>
                  <option value="dr">Debit (Assets / Expenses)</option>
                  <option value="cr">Credit (Liabilities / Income / Capital)</option>
                </select>
              </div>
              <div>
                <label className="label">Parent Group</label>
                <select className="input" value={form.parent_id || ''} onChange={e => setForm({ ...form, parent_id: e.target.value || null })}>
                  <option value="">None (top-level)</option>
                  {flatGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                className="btn-primary flex-1"
                disabled={saveGroupMutation.isPending || !form.name}
                onClick={() => saveGroupMutation.mutate(form)}
              >
                {saveGroupMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-secondary flex-1" onClick={() => { setShowGroupModal(false); setEditGroup(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
