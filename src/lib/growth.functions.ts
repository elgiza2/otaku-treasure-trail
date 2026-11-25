import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authPlayer } from './tasks.functions';
import type { GrowthResult, GrowthState } from './growth-model';

const auth = z.object({ initData: z.string().min(10).max(4096) });
export const getGrowthState = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => auth.extend({ invite: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data }): Promise<GrowthState> => {
    const { user, db } = await authPlayer(data.initData);
    const r = await db.rpc('wall_growth_load', { _tg: user.id, ...(data.invite ? { _invite: data.invite } : {}) });
    if (r.error) throw new Error(r.error.message);
    return r.data as unknown as GrowthState;
  });
export const runGrowthAction = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => auth.extend({ action: z.enum(['daily','chest','chest_ad','referrals','notify_on','notify_off','duel_create','duel_accept','duel_cancel','duel_revenge','boss','boss_ad','boss_paid']), requestId: z.string().uuid(), provider: z.enum(['adsgram','monetag']).optional(), target: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data }): Promise<GrowthResult> => {
    const { user, db } = await authPlayer(data.initData);
    if (data.action.endsWith('_ad') || data.action === 'duel_revenge') {
      if (!data.provider) throw new Error('bad_provider');
    }
    const r = await db.rpc('wall_growth_action', { _tg: user.id, _action: data.action, _request: data.requestId, ...(data.provider ? { _provider: data.provider } : {}), ...(data.target ? { _target: data.target } : {}) });
    if (r.error) throw new Error(r.error.message);
    return r.data as unknown as GrowthResult;
  });

export const getPendingMicroPayments = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => auth.parse(d))
  .handler(async ({ data }) => {
    const { user, db } = await authPlayer(data.initData);
    const r = await db.from('wall_payments').select('id, pack, amount_nano, created_at').eq('tg_id', user.id).eq('status', 'pending').in('pack', ['micro_energy','micro_spins5','micro_shield','micro_boost','boss_strike']).order('created_at', { ascending: false });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });