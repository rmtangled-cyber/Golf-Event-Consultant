import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_PARS, pickHiddenHoles } from '@/domain/scoring.ts';
import type { CompeEvent, HandicapMethod } from '@/domain/types.ts';
import { HOLE_COUNT } from '@/domain/types.ts';
import { localRepository } from './repository.ts';
import type { EventRepository } from './repository.ts';

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export interface NewEventInput {
  name: string;
  date: string;
  courseName: string;
  pars?: number[];
  handicapMethod: HandicapMethod;
  handicapCap?: number;
}

interface EventsContextValue {
  ready: boolean;
  events: CompeEvent[];
  createEvent(input: NewEventInput): CompeEvent;
  updateEvent(id: string, update: (event: CompeEvent) => CompeEvent): void;
  deleteEvent(id: string): void;
}

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({
  children,
  repository = localRepository,
}: {
  children: ReactNode;
  repository?: EventRepository;
}) {
  const [events, setEvents] = useState<CompeEvent[]>([]);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    repository.loadAll().then((loadedEvents) => {
      setEvents(loadedEvents);
      loaded.current = true;
      setReady(true);
    });
  }, [repository]);

  useEffect(() => {
    if (loaded.current) repository.saveAll(events);
  }, [events, repository]);

  const createEvent = useCallback((input: NewEventInput) => {
    const now = new Date().toISOString();
    const pars = input.pars ?? DEFAULT_PARS;
    const event: CompeEvent = {
      id: newId(),
      name: input.name,
      date: input.date,
      courseName: input.courseName,
      pars,
      handicapMethod: input.handicapMethod,
      hiddenHoles: pickHiddenHoles(pars),
      handicapCap: input.handicapCap ?? 36,
      players: [],
      scores: {},
      specialAwards: [],
      createdAt: now,
      updatedAt: now,
    };
    setEvents((prev) => [event, ...prev]);
    return event;
  }, []);

  const updateEvent = useCallback((id: string, update: (event: CompeEvent) => CompeEvent) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...update(e), updatedAt: new Date().toISOString() } : e)),
    );
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const value = useMemo(
    () => ({ ready, events, createEvent, updateEvent, deleteEvent }),
    [ready, events, createEvent, updateEvent, deleteEvent],
  );
  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents() {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error('useEvents must be used inside EventsProvider');
  return ctx;
}

/** 1つのコンペと、それを更新するヘルパー */
export function useEvent(id: string | undefined) {
  const { events, updateEvent, ready } = useEvents();
  const event = events.find((e) => e.id === id);

  const update = useCallback(
    (fn: (event: CompeEvent) => CompeEvent) => {
      if (id) updateEvent(id, fn);
    },
    [id, updateEvent],
  );

  const setStroke = useCallback(
    (playerId: string, holeIndex: number, strokes: number | null) =>
      update((e) => {
        const current = e.scores[playerId] ?? Array<number | null>(HOLE_COUNT).fill(null);
        const next = [...current];
        next[holeIndex] = strokes;
        return { ...e, scores: { ...e.scores, [playerId]: next } };
      }),
    [update],
  );

  return { ready, event, update, setStroke };
}
