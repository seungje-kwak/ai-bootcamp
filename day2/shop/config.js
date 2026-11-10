// 백엔드(FastAPI) 주소
// - 내 컴퓨터(localhost)에서 열면 로컬 백엔드
// - Vercel에 배포된 페이지에서는 Railway 백엔드
const RAILWAY_API_URL = "https://my-api-production-ea8f.up.railway.app";

const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
window.API_BASE = isLocal ? "http://localhost:8000" : RAILWAY_API_URL;
