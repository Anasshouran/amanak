import { useEffect, useState } from "react";
import { accountsApi, type User } from "../../api/accounts";

export default function UsersList() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    accountsApi
      .listUsers({ search, scope: "all" })
      .then((d: any) => !cancelled && setUsers(d.results ?? d))
      .catch((e: any) => !cancelled && setError(e?.message || "فشل التحميل"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [search]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">الحسابات</h1>
        <a
          href="/staff/accounts/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + مستخدم جديد
        </a>
      </div>

      <input
        type="search"
        placeholder="بحث بالبريد أو الاسم..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-4 px-3 py-2 border rounded"
      />

      {loading && <p className="text-gray-500">... جارٍ التحميل</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && users.length === 0 && (
        <p className="text-gray-500">لا يوجد مستخدمون.</p>
      )}

      {!loading && users.length > 0 && (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-right p-3">البريد</th>
              <th className="text-right p-3">الاسم</th>
              <th className="text-right p-3">الأدوار</th>
              <th className="text-right p-3">الحالة</th>
              <th className="text-right p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono text-sm">{u.email}</td>
                <td className="p-3">
                  {u.first_name} {u.last_name}
                </td>
                <td className="p-3 flex gap-1 flex-wrap">
                  {u.system.is_superuser && (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                      super_admin
                    </span>
                  )}
                  {u.system.is_staff && !u.system.is_superuser && (
                    <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                      staff
                    </span>
                  )}
                  {u.orgs.map((o: any) => (
                    <span
                      key={o.organization_id}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                    >
                      {o.organization_name}:{o.role}
                    </span>
                  ))}
                </td>
                <td className="p-3">{u.is_active ? "✅" : "⛔"}</td>
                <td className="p-3">
                  <a
                    href={`/staff/accounts/${u.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    تعديل
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
