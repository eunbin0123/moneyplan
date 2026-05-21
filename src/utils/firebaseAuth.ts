import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Sheets scope
provider.addScope("https://www.googleapis.com/auth/spreadsheets");

const TOKEN_KEY = "google_access_token";
const TOKEN_EXPIRY_KEY = "google_access_token_expiry";
const TOKEN_LIFETIME_MS = 55 * 60 * 1000; // 55분 (Google 토큰 만료 1시간보다 5분 여유)

let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem(TOKEN_KEY);

function isTokenExpired(): boolean {
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return true;
  return Date.now() > parseInt(expiry, 10);
}

function saveToken(token: string) {
  cachedAccessToken = token;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_LIFETIME_MS));
}

function clearToken() {
  cachedAccessToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

// Initialize auth state listener
export const initAuth = (
    onAuthSuccess?: (user: User, token: string) => void,
    onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken && !isTokenExpired()) {
        // 유효한 토큰이 있으면 바로 사용
        cachedAccessToken = storedToken;
        if (onAuthSuccess) onAuthSuccess(user, storedToken);
      } else if (!isSigningIn) {
        // 토큰 만료 또는 없으면 자동 재로그인 시도
        clearToken();
        try {
          const result = await signInWithPopup(auth, provider);
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            saveToken(credential.accessToken);
            if (onAuthSuccess) onAuthSuccess(user, credential.accessToken);
          } else {
            if (onAuthFailure) onAuthFailure();
          }
        } catch {
          // 팝업 차단 등으로 실패하면 onAuthFailure 호출 (수동 로그인 유도)
          if (onAuthFailure) onAuthFailure();
        }
      }
    } else {
      clearToken();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Google access token을 가져올 수 없습니다.");
    }

    saveToken(credential.accessToken);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken && !isTokenExpired()) {
    return cachedAccessToken;
  }
  // 만료됐으면 null 반환 → 호출하는 쪽에서 재로그인 유도
  clearToken();
  return null;
};

export const logout = async () => {
  await auth.signOut();
  clearToken();
};