// 백엔드(FastAPI) 주소
// - 로컬(localhost)에서 열면 로컬 백엔드를 사용
// - Vercel에 배포된 페이지에서는 Railway 주소를 사용 (배포 후 아래 값을 바꿔주세요)
const RAILWAY_API_URL = "https://your-app.up.railway.app";

const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
window.API_BASE = isLocal ? "http://localhost:8000" : RAILWAY_API_URL;
