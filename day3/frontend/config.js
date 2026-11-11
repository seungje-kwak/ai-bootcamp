// 백엔드(FastAPI) 주소
// - 내 컴퓨터(127.0.0.1 / localhost)에서 열면 → 로컬 백엔드 http://127.0.0.1:8000
// - Vercel에 배포된 화면에서는 → Railway 주소 (Railway에서 Generate Domain 한 뒤 아래 값을 바꾸세요, 끝에 / 없이)
const RAILWAY_API_URL = "https://여기에-railway-주소.up.railway.app";

const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
window.API_BASE = isLocal ? "http://127.0.0.1:8000" : RAILWAY_API_URL;
