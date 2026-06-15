"use client";

import { useState, useEffect, useCallback } from "react";

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  timeRaw: string;
  date: string;
  type: "video" | "users" | "alert";
  details: string;
  color: string;
  startDateTime?: string;
  endDateTime?: string;
}

interface UseCalendarReturn {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  selectedDate: Date;
  navigatedDate: Date;
  selectedDateEvents: CalendarEvent[];
  calendarCells: CalendarCell[];
  setSelectedDate: (date: Date) => void;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  handleSelectDate: (date: Date) => void;
  createEvent: (event: CreateEventInput) => Promise<void>;
  refreshEvents: () => Promise<void>;
}

export interface CalendarCell {
  day: number;
  isCurrentMonth: boolean;
  date: Date;
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  attendees?: string[];
  addMeet?: boolean;
}

export function useCalendar(): UseCalendarReturn {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [navigatedDate, setNavigatedDate] = useState<Date>(new Date());

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setIsDemo(data.demo ?? true);
      } else {
        setError("Failed to fetch calendar events");
      }
    } catch {
      setError("Failed to fetch calendar events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Calendar grid generation
  const getCalendarCells = useCallback((date: Date): CalendarCell[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: CalendarCell[] = [];

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      cells.push({ day, isCurrentMonth: false, date: new Date(year, month - 1, day) });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, isCurrentMonth: true, date: new Date(year, month, day) });
    }

    const remainingCells = 42 - cells.length;
    for (let day = 1; day <= remainingCells; day++) {
      cells.push({ day, isCurrentMonth: false, date: new Date(year, month + 1, day) });
    }

    return cells;
  }, []);

  const calendarCells = getCalendarCells(navigatedDate);

  const handlePrevMonth = useCallback(() => {
    setNavigatedDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  }, []);

  const handleNextMonth = useCallback(() => {
    setNavigatedDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  }, []);

  const handleSelectDate = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      if (
        date.getMonth() !== navigatedDate.getMonth() ||
        date.getFullYear() !== navigatedDate.getFullYear()
      ) {
        setNavigatedDate(new Date(date.getFullYear(), date.getMonth(), 1));
      }
    },
    [navigatedDate]
  );

  // Filter events for selected date
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  const selectedDateEvents = events.filter((e) => {
    if (e.startDateTime) {
      const startD = new Date(e.startDateTime);
      const endD = e.endDateTime ? new Date(e.endDateTime) : startD;
      const cellDate = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );
      const startDay = new Date(
        startD.getFullYear(),
        startD.getMonth(),
        startD.getDate()
      );
      const endDay = new Date(
        endD.getFullYear(),
        endD.getMonth(),
        endD.getDate()
      );
      return cellDate >= startDay && cellDate <= endDay;
    }
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (isSameDay(selectedDate, today)) return e.date === "today";
    if (isSameDay(selectedDate, tomorrow)) return e.date === "tomorrow";
    return false;
  });

  const createEvent = useCallback(
    async (input: CreateEventInput) => {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to create event");
      await fetchEvents();
    },
    [fetchEvents]
  );

  return {
    events,
    loading,
    error,
    isDemo,
    selectedDate,
    navigatedDate,
    selectedDateEvents,
    calendarCells,
    setSelectedDate,
    handlePrevMonth,
    handleNextMonth,
    handleSelectDate,
    createEvent,
    refreshEvents: fetchEvents,
  };
}
