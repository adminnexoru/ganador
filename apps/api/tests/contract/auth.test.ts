import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestContext } from '../helpers/app';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(() => ctx.close());

const phone = '+525511112222';

describe('POST /v1/auth/otp', () => {
  it('responde 202 y envía el código por WhatsApp', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/auth/otp', payload: { phone } });
    expect(res.statusCode).toBe(202);
    const msg = ctx.messaging.sent.at(-1);
    expect(msg).toMatchObject({ kind: 'otp', to: phone, channel: 'whatsapp' });
  });

  it('acepta 10 dígitos y los normaliza a +52', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/auth/otp', payload: { phone: '5599998888' } });
    expect(res.statusCode).toBe(202);
    expect(ctx.messaging.sent.at(-1)).toMatchObject({ to: '+525599998888' });
  });

  it('rechaza un número inválido con 400', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/auth/otp', payload: { phone: '123' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_phone');
    expect(res.json().error.message).toMatch(/celular/);
  });

  it('usa SMS si WhatsApp falla', async () => {
    ctx.messaging.failing.add('whatsapp');
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/auth/otp', payload: { phone: '+525500000001' } });
    ctx.messaging.failing.clear();
    expect(res.statusCode).toBe(202);
    expect(ctx.messaging.sent.at(-1)).toMatchObject({ to: '+525500000001', channel: 'sms' });
  });

  it('responde 429 al pedir un sexto código en una hora', async () => {
    const p = '+525500000002';
    for (let i = 0; i < 5; i++) {
      const ok = await ctx.app.inject({ method: 'POST', url: '/v1/auth/otp', payload: { phone: p } });
      expect(ok.statusCode).toBe(202);
    }
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/auth/otp', payload: { phone: p } });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('too_many_codes');
    ctx.clock.advance(61 * 60 * 1000);
    const again = await ctx.app.inject({ method: 'POST', url: '/v1/auth/otp', payload: { phone: p } });
    expect(again.statusCode).toBe(202);
  });
});

describe('POST /v1/auth/verify', () => {
  it('con código correcto devuelve tokens y needsConsent para usuario nuevo', async () => {
    const p = '+525500000003';
    await ctx.app.inject({ method: 'POST', url: '/v1/auth/otp', payload: { phone: p } });
    const code = ctx.messaging.lastCode(p)!;
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { phone: p, code } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeTypeOf('string');
    expect(body.refreshToken).toBeTypeOf('string');
    expect(body.needsConsent).toBe(true);
    expect(body.user).toMatchObject({ phone: p, whatsappConfirmed: true, whatsappAlertsEnabled: false });
  });

  it('el código no se puede usar dos veces', async () => {
    const p = '+525500000004';
    await ctx.app.inject({ method: 'POST', url: '/v1/auth/otp', payload: { phone: p } });
    const code = ctx.messaging.lastCode(p)!;
    await ctx.app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { phone: p, code } });
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { phone: p, code } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_code');
  });

  it('invalida el código tras 5 intentos fallidos', async () => {
    const p = '+525500000005';
    await ctx.app.inject({ method: 'POST', url: '/v1/auth/otp', payload: { phone: p } });
    const code = ctx.messaging.lastCode(p)!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const r = await ctx.app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { phone: p, code: wrong } });
      expect(r.statusCode).toBe(400);
    }
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { phone: p, code } });
    expect(res.statusCode).toBe(400);
  });

  it('el código vence a los 10 minutos', async () => {
    const p = '+525500000006';
    await ctx.app.inject({ method: 'POST', url: '/v1/auth/otp', payload: { phone: p } });
    const code = ctx.messaging.lastCode(p)!;
    ctx.clock.advance(11 * 60 * 1000);
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { phone: p, code } });
    expect(res.statusCode).toBe(400);
  });

  it('si el código llegó por SMS, whatsappConfirmed es falso', async () => {
    const p = '+525500000007';
    ctx.messaging.failing.add('whatsapp');
    await ctx.app.inject({ method: 'POST', url: '/v1/auth/otp', payload: { phone: p } });
    ctx.messaging.failing.clear();
    const code = ctx.messaging.lastCode(p)!;
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { phone: p, code } });
    expect(res.json().user.whatsappConfirmed).toBe(false);
  });
});

describe('POST /v1/auth/refresh y /v1/auth/logout', () => {
  it('rota el token de renovación', async () => {
    const s = await ctx.login('+525500000008', { consent: false });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: s.refreshToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().refreshToken).not.toBe(s.refreshToken);
    const reuse = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: s.refreshToken },
    });
    expect(reuse.statusCode).toBe(401);
  });

  it('logout responde 204 e invalida la sesión', async () => {
    const s = await ctx.login('+525500000009');
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/auth/logout', headers: s.headers });
    expect(res.statusCode).toBe(204);
    const me = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: s.headers });
    expect(me.statusCode).toBe(401);
  });

  it('el token de acceso vence a los 15 minutos', async () => {
    const s = await ctx.login('+525500000010');
    ctx.clock.advance(16 * 60 * 1000);
    const me = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: s.headers });
    expect(me.statusCode).toBe(401);
  });
});
