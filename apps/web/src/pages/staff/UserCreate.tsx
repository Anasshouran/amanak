import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { accountsApi } from "../../api/accounts";

export default function UserCreate() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isStaff, setIsStaff] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const created: any = await accountsApi.createUser({
        email,
        first_name: firstName,
        last_name: lastName,
        is_staff: isStaff,
        is_superuser: isSuper,
      });
      setTempPassword(created.temp_password);
    } catch (e: any) {
      setError(
        e?.response?.data?.email?.[0] || e?.message || "فشل إنشاء المستخدم"
      );
    } finally {
      setLoading(false);
    }
  }

  if (tempPassword) {
    return (
      <div className="p-6 max-w-lg">
        <h1 className="text-2xl font-bold mb-4">✅ تم إنشاء المستخدم</h1>
        <p className="mb-2">
          كلمة المرور المؤقتة <strong>تظهر مرة واحدة فقط</strong>. انسخها الآن وأرسلها
          للمستخدم:
        </p>
        <pre className="p-4 bg-gray-100 rounded font-mono text-lg select-all">
          {tempPassword}
        </pre>
        <button
          onClick={() => nav("/staff/accounts")}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          العودة للقائمة
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 max-w-lg">
      <h1 className="text-2xl font-bold mb-4">مستخدم جديد</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded">
          {error}
        </div>
      )}

      <label className="block mb-3">
        <span className="block mb-1">البريد *</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
      </label>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <label>
          <span className="block mb-1">الاسم الأول</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </label>
        <label>
          <span className="block mb-1">اسم العائلة</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 mb-2">
        <input
          type="checkbox"
          checked={isStaff}
          onChange={(e) => setIsStaff(e.target.checked)}
        />
        <span>Staff (صلاحية على المنصة)</span>
      </label>

      <label className="flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          checked={isSuper}
          onChange={(e) => setIsSuper(e.target.checked)}
        />
        <span>Super Admin</span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {loading ? "..." : "إنشاء"}
      </button>
    </form>
  );
}
