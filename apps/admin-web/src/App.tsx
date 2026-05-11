import { useCallback, useState } from 'react';
import { adminLogin, adminRefresh } from './api/admin-auth';
import {
  getContentAdminDetail,
  type PlatformContentAdminDetail,
} from './api/content-admin-detail';
import {
  type ContentTransferRecordsPage,
  getContentTransferRecords,
} from './api/content-transfer-records';
import { AdminApiError } from './api/http';
import { adminApiOrigin } from './lib/admin-api-origin';
import './App.css';

const App = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [contentId, setContentId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [records, setRecords] = useState<ContentTransferRecordsPage | null>(
    null,
  );
  const [detail, setDetail] = useState<PlatformContentAdminDetail | null>(null);

  const apiHint =
    adminApiOrigin().length > 0
      ? `当前 API 根：${adminApiOrigin()}`
      : '当前为同源请求 + 开发代理（/admin → Nest，默认端口 3001）';

  const onLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setMessage(null);
      try {
        const data = await adminLogin(email.trim(), password);
        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken);
        setPassword('');
      } catch (err) {
        if (err instanceof AdminApiError) {
          setMessage(`${err.code}：${err.message}`);
        } else {
          setMessage(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password],
  );

  const onLoadRecords = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!accessToken) {
        return;
      }
      setLoading(true);
      setMessage(null);
      setRecords(null);
      setDetail(null);
      const loadWithToken = async (token: string) => {
        const cid = contentId.trim();
        return Promise.all([
          getContentAdminDetail(cid, token),
          getContentTransferRecords(cid, token, { page, pageSize }),
        ]);
      };
      try {
        const [d, r] = await loadWithToken(accessToken);
        setDetail(d);
        setRecords(r);
      } catch (err) {
        if (
          err instanceof AdminApiError &&
          err.code === 'AUTH_INVALID_TOKEN' &&
          refreshToken
        ) {
          try {
            const next = await adminRefresh(refreshToken);
            setAccessToken(next.accessToken);
            setRefreshToken(next.refreshToken);
            const [d, r] = await loadWithToken(next.accessToken);
            setDetail(d);
            setRecords(r);
          } catch (inner) {
            if (inner instanceof AdminApiError) {
              setMessage(`${inner.code}：${inner.message}`);
            } else {
              setMessage(
                inner instanceof Error ? inner.message : String(inner),
              );
            }
          }
        } else if (err instanceof AdminApiError) {
          setMessage(`${err.code}：${err.message}`);
        } else {
          setMessage(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setLoading(false);
      }
    },
    [accessToken, refreshToken, contentId, page, pageSize],
  );

  const onLogout = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setRecords(null);
    setDetail(null);
    setMessage(null);
  }, []);

  return (
    <div className="min-h-screen px-4 py-10 text-left text-slate-100 sm:px-8">
      <header className="mb-8 max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Flasenc 管理后台
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          内容复核与转让记录（
          <code className="text-slate-300">
            GET /admin/v1/contents/:contentId
          </code>{' '}
          与 <code className="text-slate-300">…/transfer-records</code>
          ）。{apiHint}
        </p>
      </header>

      {message ? (
        <div
          className="mb-6 max-w-4xl rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-100"
          role="alert"
        >
          {message}
        </div>
      ) : null}

      {!accessToken ? (
        <form
          onSubmit={onLogin}
          className="max-w-md space-y-4 rounded-lg border border-slate-700/80 bg-slate-900/50 p-6 shadow-lg backdrop-blur"
        >
          <h2 className="text-lg font-medium text-slate-200">登录</h2>
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm text-slate-400">
              邮箱
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm text-slate-400">
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
      ) : (
        <div className="max-w-5xl space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onLogout}
              className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              退出登录
            </button>
          </div>

          <form
            onSubmit={onLoadRecords}
            className="space-y-4 rounded-lg border border-slate-700/80 bg-slate-900/50 p-6 shadow-lg backdrop-blur"
          >
            <h2 className="text-lg font-medium text-slate-200">
              按内容 ID 查询详情与转让记录
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <label
                  htmlFor="contentId"
                  className="block text-sm text-slate-400"
                >
                  contentId（UUID）
                </label>
                <input
                  id="contentId"
                  name="contentId"
                  required
                  value={contentId}
                  onChange={(ev) => setContentId(ev.target.value)}
                  placeholder="00000000-0000-4000-8000-000000000001"
                  className="w-full rounded border border-slate-600 bg-slate-950/80 px-3 py-2 font-mono text-sm text-slate-100 outline-none ring-sky-500 focus:ring-2"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="page" className="block text-sm text-slate-400">
                  page
                </label>
                <input
                  id="page"
                  name="page"
                  type="number"
                  min={1}
                  value={page}
                  onChange={(ev) =>
                    setPage(Number.parseInt(ev.target.value, 10) || 1)
                  }
                  className="w-24 rounded border border-slate-600 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 sm:shrink-0"
              >
                {loading ? '查询中…' : '查询'}
              </button>
            </div>
          </form>

          {detail ? (
            <section className="space-y-3 rounded-lg border border-slate-700/80 bg-slate-900/50 p-6 shadow-lg backdrop-blur">
              <h3 className="text-base font-medium text-slate-200">
                内容详情（平台只读）
              </h3>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">title</dt>
                  <dd className="font-medium text-slate-100">
                    {detail.title ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">publishStatus</dt>
                  <dd className="font-mono text-slate-200">
                    {detail.publishStatus}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">listingState</dt>
                  <dd className="font-mono text-slate-200">
                    {detail.listingState}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">placeholderKind</dt>
                  <dd className="font-mono text-slate-200">
                    {detail.placeholderKind}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">ownerMemberId</dt>
                  <dd className="break-all font-mono text-xs text-slate-300">
                    {detail.ownerMemberId ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">entitlementId</dt>
                  <dd className="break-all font-mono text-xs text-slate-300">
                    {detail.entitlementId ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">createdAt</dt>
                  <dd className="font-mono text-xs text-slate-300">
                    {detail.createdAt}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">updatedAt</dt>
                  <dd className="font-mono text-xs text-slate-300">
                    {detail.updatedAt}
                  </dd>
                </div>
              </dl>
              <details className="rounded border border-slate-700/60 bg-slate-950/40">
                <summary className="cursor-pointer px-3 py-2 text-sm text-slate-400 hover:text-slate-300">
                  body（JSON，可折叠）
                </summary>
                <pre className="max-h-56 overflow-auto border-t border-slate-700/60 p-3 font-mono text-xs leading-relaxed text-slate-300">
                  {JSON.stringify(detail.body, null, 2)}
                </pre>
              </details>
            </section>
          ) : null}

          {records ? (
            <div className="overflow-x-auto rounded-lg border border-slate-700/80 bg-slate-900/40">
              <p className="border-b border-slate-700/60 px-4 py-2 text-sm text-slate-400">
                共 {records.total} 条 · 第 {records.page} /{' '}
                {Math.max(1, Math.ceil(records.total / records.pageSize))} 页 ·
                pageSize={records.pageSize}
              </p>
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-700/80 bg-slate-950/60 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">id</th>
                    <th className="px-3 py-2 font-medium">method</th>
                    <th className="px-3 py-2 font-medium">status</th>
                    <th className="px-3 py-2 font-medium">from</th>
                    <th className="px-3 py-2 font-medium">to</th>
                    <th className="px-3 py-2 font-medium">expiresAt</th>
                    <th className="px-3 py-2 font-medium">createdAt</th>
                  </tr>
                </thead>
                <tbody>
                  {records.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        暂无记录
                      </td>
                    </tr>
                  ) : (
                    records.items.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-800/80 odd:bg-slate-950/30"
                      >
                        <td className="max-w-[10rem] truncate px-3 py-2 font-mono text-xs">
                          {row.id}
                        </td>
                        <td className="px-3 py-2">{row.method}</td>
                        <td className="px-3 py-2">{row.status}</td>
                        <td className="max-w-[8rem] truncate px-3 py-2 font-mono text-xs">
                          {row.fromMemberId}
                        </td>
                        <td className="max-w-[8rem] truncate px-3 py-2 font-mono text-xs">
                          {row.toMemberId ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-300">
                          {row.expiresAt}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-300">
                          {row.createdAt}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default App;
