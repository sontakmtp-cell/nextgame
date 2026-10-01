import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import './style.css';
function App() {
  const [status, setStatus] = useState('Đang kiểm tra kết nối…');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/health', { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error('API');
      const body: unknown = await r.json();
      setStatus(typeof body === 'object' && body !== null && 'status' in body && body.status === 'ok' ? 'API đã kết nối' : 'API trả dữ liệu không hợp lệ');
    }).catch(() => { if (!controller.signal.aborted) setStatus('API chưa kết nối'); });
    return () => controller.abort();
  }, []);
  return <main><p>PROMPT CHIẾN / G0</p><h1>Xây trí tuệ.<br/>Chứng minh trên đấu trường.</h1><p>Nền dữ liệu và Brain đang được kiểm chứng. Workshop và đấu trường sẽ mở ở các giai đoạn tiếp theo.</p><p role="status">{status}</p><a href="/api/ready">Kiểm tra môi trường local</a></main>;
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<App/>);
