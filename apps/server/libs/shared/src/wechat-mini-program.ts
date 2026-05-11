/**
 * 微信小程序 **`auth.code2Session`**（服务端换 **`openid`** / **`session_key`**）。
 * 文档：<https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html>
 */
export type WechatCode2SessionOk = {
  ok: true;
  openid: string;
  unionid: string | null;
  session_key: string;
};

export type WechatCode2SessionErr = {
  ok: false;
  errcode: number;
  errmsg: string;
};

export type WechatCode2SessionResult =
  | WechatCode2SessionOk
  | WechatCode2SessionErr;

export function wechatMiniProgramCredentialsFromEnv(): {
  appid: string;
  secret: string;
} | null {
  const appid = process.env.WECHAT_MINI_PROGRAM_APPID?.trim();
  const secret = process.env.WECHAT_MINI_PROGRAM_SECRET?.trim();
  if (!appid || !secret) {
    return null;
  }
  return { appid, secret };
}

export async function wechatMiniProgramCode2Session(
  code: string,
): Promise<WechatCode2SessionResult> {
  const cred = wechatMiniProgramCredentialsFromEnv();
  if (!cred) {
    return {
      ok: false,
      errcode: -1,
      errmsg: 'WECHAT_MINI_PROGRAM_NOT_CONFIGURED',
    };
  }
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', cred.appid);
  url.searchParams.set('secret', cred.secret);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch {
    return { ok: false, errcode: -2, errmsg: 'WECHAT_UPSTREAM_NETWORK_ERROR' };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, errcode: -3, errmsg: 'WECHAT_UPSTREAM_BAD_JSON' };
  }
  if (!json || typeof json !== 'object') {
    return { ok: false, errcode: -4, errmsg: 'WECHAT_UPSTREAM_EMPTY' };
  }
  const o = json as Record<string, unknown>;
  if (typeof o.errcode === 'number' && o.errcode !== 0) {
    return {
      ok: false,
      errcode: o.errcode,
      errmsg: typeof o.errmsg === 'string' ? o.errmsg : 'wechat_error',
    };
  }
  if (typeof o.openid !== 'string' || o.openid.length < 8) {
    return { ok: false, errcode: -5, errmsg: 'WECHAT_OPENID_MISSING' };
  }
  return {
    ok: true,
    openid: o.openid,
    unionid:
      typeof o.unionid === 'string' && o.unionid.length > 0 ? o.unionid : null,
    session_key: typeof o.session_key === 'string' ? o.session_key : '',
  };
}
