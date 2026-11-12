import type { CompeEvent } from '@/domain/types.ts';
import { HOLE_COUNT } from '@/domain/types.ts';
import type { EventInfo, PlayerInfo, ScoreInfo, AwardInfo, GroupInfo } from './types.ts';

/** サーバーのデータを、順位計算（domain/scoring）が使う形に変換する */
export function toCompeEvent(input: {
  event: EventInfo;
  groups: GroupInfo[];
  players: PlayerInfo[];
  scores: ScoreInfo[];
  awards: AwardInfo[];
}): CompeEvent {
  const groupNumber = new Map(input.groups.map((g) => [g.id, g.number]));
  const scores: CompeEvent['scores'] = {};
  for (const p of input.players) scores[p.id] = Array<number | null>(HOLE_COUNT).fill(null);
  for (const s of input.scores) {
    if (scores[s.playerId]) scores[s.playerId][s.hole - 1] = s.strokes;
  }
  return {
    id: input.event.id,
    name: input.event.name,
    date: input.event.date,
    courseName: input.event.courseName,
    pars: input.event.pars,
    handicapMethod: input.event.handicapMethod,
    hiddenHoles: input.event.hiddenHoles,
    handicapCap: input.event.handicapCap,
    players: input.players.map((p) => ({
      id: p.id,
      name: p.name,
      handicap: p.handicap ?? undefined,
      group: p.groupId ? groupNumber.get(p.groupId) : undefined,
    })),
    scores,
    specialAwards: input.awards.map((a) => ({
      id: a.id,
      kind: a.kind,
      hole: a.hole,
      winnerPlayerId: a.winnerPlayerId ?? undefined,
      note: a.note || undefined,
    })),
    createdAt: '',
    updatedAt: '',
  };
}
