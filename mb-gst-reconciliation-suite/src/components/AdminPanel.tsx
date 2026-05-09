import React, { useState, useEffect } from 'react';
import { db, UserProfile, UserRole, ActivityLog, deleteActivity } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import { UserCheck, UserX, Shield, User, Mail, Clock, Trash2, History, Users as UsersIcon } from 'lucide-react';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'activity'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('email', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(userList);
      if (activeTab === 'users') setLoading(false);
    });
    return () => unsubscribe();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'activity') {
      setLoading(true);
      const q = query(collection(db, 'activity'), orderBy('timestamp', 'desc'), limit(100));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const activityList = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        } as ActivityLog));
        setActivities(activityList);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  const handleToggleAuth = async (uid: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isAuthorized: !currentStatus
      });
    } catch (error) {
      console.error("Error updating authorization:", error);
      alert("Failed to update authorization. Check permissions.");
    }
  };

  const handleUpdateRole = async (uid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: newRole
      });
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Failed to update role. Check permissions.");
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this action record? This cannot be undone.")) return;
    try {
      await deleteActivity(id);
    } catch (error) {
      console.error("Error deleting activity:", error);
      alert("Failed to delete activity. Check permissions.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mb-red"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-mb-gray tracking-tight uppercase">Admin Control Center</h2>
          <p className="text-sm text-gray-500">Manage users, roles, and system activity logs.</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-2xl border shadow-sm">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'users' ? 'bg-mb-red text-white shadow-md' : 'text-gray-400 hover:text-mb-gray'
            }`}
          >
            <UsersIcon size={14} />
            Users
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'activity' ? 'bg-mb-red text-white shadow-md' : 'text-gray-400 hover:text-mb-gray'
            }`}
          >
            <History size={14} />
            Activity
          </button>
        </div>
      </div>

      {activeTab === 'users' ? (
        <div className="space-y-6">
          <div className="flex justify-end">
            <div className="bg-white px-4 py-2 rounded-xl border shadow-sm flex items-center gap-2">
              <Shield size={16} className="text-mb-red" />
              <span className="text-xs font-black text-mb-gray uppercase tracking-widest">{users.length} Total Users</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400">User</th>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400">Role</th>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400">Status</th>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((user) => (
                    <tr key={user.uid} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-mb-light flex items-center justify-center overflow-hidden border border-gray-100">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <User size={20} className="text-mb-red" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-mb-gray">{user.displayName || 'New User'}</p>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Mail size={10} /> {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateRole(user.uid, e.target.value as UserRole)}
                          className="bg-gray-50 border border-gray-200 text-mb-gray text-xs font-bold rounded-lg focus:ring-mb-red focus:border-mb-red block w-full p-2 outline-none"
                        >
                          <option value="admin">Admin</option>
                          <option value="portal_action">Portal Action</option>
                          <option value="view_only">View Only</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border ${
                          user.isAuthorized 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-mb-red/5 text-mb-red border-mb-red/20'
                        }`}>
                          {user.isAuthorized ? <UserCheck size={12} /> : <UserX size={12} />}
                          {user.isAuthorized ? 'Authorized' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleToggleAuth(user.uid, user.isAuthorized)}
                          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                            user.isAuthorized 
                              ? 'text-mb-red hover:bg-mb-red/5' 
                              : 'bg-mb-red text-white hover:bg-mb-red-dark shadow-md'
                          }`}
                        >
                          {user.isAuthorized ? 'Revoke' : 'Authorize'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end">
            <div className="bg-white px-4 py-2 rounded-xl border shadow-sm flex items-center gap-2">
              <History size={16} className="text-mb-red" />
              <span className="text-xs font-black text-mb-gray uppercase tracking-widest">{activities.length} Recent Actions</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400">Action</th>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400">User</th>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400">Time</th>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-gray-400 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activities.map((activity) => (
                    <tr key={activity.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-mb-gray uppercase tracking-tight text-xs">{activity.title}</p>
                          <p className="text-[10px] text-gray-400">{activity.description}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-medium text-gray-600">{activity.userEmail}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Clock size={12} />
                          <span className="text-[10px]">
                            {activity.timestamp?.toDate().toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => activity.id && handleDeleteActivity(activity.id)}
                          className="p-2 text-gray-300 hover:text-mb-red hover:bg-mb-red/5 rounded-lg transition-all"
                          title="Delete Action Record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {activities.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
                        No activity records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
