const AFTER_LOGIN_KEY = 'golf-compe/after-login';

/** ログイン後に戻したい画面を覚えておく（幹事招待リンクなど） */
export function rememberAfterLogin(path: string) {
  globalThis.sessionStorage?.setItem(AFTER_LOGIN_KEY, path);
}

/** 覚えておいた画面を取り出す（1回だけ） */
export function takeAfterLogin(): string | null {
  const next = globalThis.sessionStorage?.getItem(AFTER_LOGIN_KEY) ?? null;
  globalThis.sessionStorage?.removeItem(AFTER_LOGIN_KEY);
  return next;
}
