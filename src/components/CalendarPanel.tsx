"use client";

import React, { useState } from "react";
import AiAgentPanel from "@/components/AiAgentPanel";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  TriangleAlert,
  Users,
  Video,
  X,
} from "lucide-react";
import type { CalendarEvent, CalendarCell, CreateEventInput } from "@/hooks/useCalendar";

interface CalendarPanelProps {
  events: CalendarEvent[];
  selectedDate: Date;
  navigatedDate: Date;
  selectedDateEvents: CalendarEvent[];
  calendarCells: CalendarCell[];
  loading: boolean;
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onCreateEvent: (input: CreateEventInput) => Promise<void>;
}

export default function CalendarPanel({
  events,
  selectedDate,
  navigatedDate,
  selectedDateEvents,
  calendarCells,
  loading,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onCreateEvent,
}: CalendarPanelProps) {
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    summary: "",
    date: "",
    startTime: "",
    endTime: "",
    attendees: "",
  });
  const [creating, setCreating] = useState(false);

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  const isToday = isSameDay(selectedDate, today);
  const isTomorrow = isSameDay(selectedDate, tomorrow);

  const dateLabel = isToday
    ? `Today · ${selectedDate.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}`
    : isTomorrow
    ? `Tomorrow · ${selectedDate.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}`
    : selectedDate.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const handleCreateEvent = async () => {
    if (!newEvent.summary || !newEvent.date || !newEvent.startTime) return;
    setCreating(true);
    try {
      const startDateTime = `${newEvent.date}T${newEvent.startTime}:00`;
      const endDateTime = newEvent.endTime
        ? `${newEvent.date}T${newEvent.endTime}:00`
        : `${newEvent.date}T${newEvent.startTime.split(":").map((v, i) => (i === 0 ? String(Number(v) + 1).padStart(2, "0") : v)).join(":")}:00`;

      await onCreateEvent({
        summary: newEvent.summary,
        startDateTime,
        endDateTime,
        attendees: newEvent.attendees
          ? newEvent.attendees.split(",").map((e) => e.trim())
          : undefined,
      });
      setNewEvent({ summary: "", date: "", startTime: "", endTime: "", attendees: "" });
      setShowNewEvent(false);
    } catch {
      // Handle error
    } finally {
      setCreating(false);
    }
  };

  const getEventIcon = (type: string) => {
    if (type === "video") return Video;
    if (type === "alert") return TriangleAlert;
    return Users;
  };

  return (
    <aside
      className="calendar-desktop shrink-0 flex p-4 flex-col w-[280px] h-full min-h-0 overflow-hidden justify-between transition-colors"
      style={{ background: "rgb(var(--bg-primary))" }}
    >
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex px-2 pt-2 pb-4 justify-between items-center">
          <h2 className="font-semibold text-base leading-6" style={{ color: "rgb(var(--text-primary))" }}>
            Calendar
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewEvent(!showNewEvent)}
              className="size-7 rounded-lg flex justify-center items-center transition-colors"
              style={{
                background: "rgb(var(--bg-tertiary))",
                color: "rgb(var(--text-secondary))",
              }}
              title="New Event"
            >
              <Plus className="size-4" />
            </button>
            <button
              onClick={onPrevMonth}
              className="size-7 rounded-lg flex justify-center items-center transition-colors"
              style={{
                background: "rgb(var(--bg-tertiary))",
                color: "rgb(var(--text-secondary))",
              }}
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-medium text-sm leading-5" style={{ color: "rgb(var(--text-primary))" }}>
              {navigatedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button
              onClick={onNextMonth}
              className="size-7 rounded-lg flex justify-center items-center transition-colors"
              style={{
                background: "rgb(var(--bg-tertiary))",
                color: "rgb(var(--text-secondary))",
              }}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* New Event Form */}
        {showNewEvent && (
          <div
            className="rounded-xl border p-3 mb-4 animate-slide-down"
            style={{
              borderColor: "rgba(var(--border-primary))",
              background: "rgb(var(--bg-secondary))",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: "rgb(var(--text-primary))" }}>
                New Event
              </span>
              <button onClick={() => setShowNewEvent(false)}>
                <X className="size-3.5" style={{ color: "rgb(var(--text-secondary))" }} />
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={newEvent.summary}
                onChange={(e) => setNewEvent({ ...newEvent, summary: e.target.value })}
                placeholder="Event title"
                className="w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                style={{
                  background: "rgb(var(--bg-primary))",
                  borderColor: "rgba(var(--border-primary))",
                  color: "rgb(var(--text-primary))",
                }}
              />
              <input
                type="date"
                value={newEvent.date}
                onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                className="w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                style={{
                  background: "rgb(var(--bg-primary))",
                  borderColor: "rgba(var(--border-primary))",
                  color: "rgb(var(--text-primary))",
                }}
              />
              <div className="flex gap-2">
                <input
                  type="time"
                  value={newEvent.startTime}
                  onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                  className="flex-1 rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                  style={{
                    background: "rgb(var(--bg-primary))",
                    borderColor: "rgba(var(--border-primary))",
                    color: "rgb(var(--text-primary))",
                  }}
                />
                <input
                  type="time"
                  value={newEvent.endTime}
                  onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                  className="flex-1 rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                  style={{
                    background: "rgb(var(--bg-primary))",
                    borderColor: "rgba(var(--border-primary))",
                    color: "rgb(var(--text-primary))",
                  }}
                />
              </div>
              <input
                type="text"
                value={newEvent.attendees}
                onChange={(e) => setNewEvent({ ...newEvent, attendees: e.target.value })}
                placeholder="Attendees (comma-separated emails)"
                className="w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                style={{
                  background: "rgb(var(--bg-primary))",
                  borderColor: "rgba(var(--border-primary))",
                  color: "rgb(var(--text-primary))",
                }}
              />
              <button
                onClick={handleCreateEvent}
                disabled={!newEvent.summary || !newEvent.date || !newEvent.startTime || creating}
                className="w-full py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                style={{
                  background: "rgb(var(--btn-primary-bg))",
                  color: "rgb(var(--btn-primary-text))",
                }}
              >
                {creating ? "Creating..." : "Create Event"}
              </button>
            </div>
          </div>
        )}

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 text-center gap-y-2 text-xs">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
            <span key={day} className="font-medium" style={{ color: "rgb(var(--text-secondary))" }}>
              {day}
            </span>
          ))}

          {calendarCells.map((cell, idx) => {
            const isSelected = isSameDay(selectedDate, cell.date);
            const isTodayCell = isSameDay(today, cell.date);

            const hasEvent = events.find((e) => {
              if (!e.startDateTime) return false;
              const startD = new Date(e.startDateTime);
              const endD = e.endDateTime ? new Date(e.endDateTime) : startD;
              const cellTime = new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate()).getTime();
              const startTime = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate()).getTime();
              const endTime = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate()).getTime();
              return cellTime >= startTime && cellTime <= endTime;
            });

            return (
              <div
                key={idx}
                onClick={() => onSelectDate(cell.date)}
                className="relative py-1 flex items-center justify-center cursor-pointer select-none"
              >
                <span
                  className="size-6 flex items-center justify-center rounded-full text-xs transition-all"
                  style={{
                    background: isSelected
                      ? "rgb(var(--btn-primary-bg))"
                      : isTodayCell
                      ? "rgba(var(--accent-purple), 0.15)"
                      : "transparent",
                    color: isSelected
                      ? "rgb(var(--btn-primary-text))"
                      : cell.isCurrentMonth
                      ? "rgb(var(--text-primary))"
                      : "rgba(var(--text-primary), 0.3)",
                    fontWeight: isSelected || isTodayCell ? 600 : 400,
                  }}
                >
                  {cell.day}
                </span>
                {hasEvent && (
                  <span
                    className="size-1 rounded-full absolute bottom-0.5 left-1/2 -translate-x-1/2"
                    style={{
                      backgroundColor: isSelected ? "rgb(var(--btn-primary-text))" : hasEvent.color,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Events for Selected Date */}
        <div className="overflow-y-auto mt-6 flex-1 pr-1">
          <p
            className="font-semibold uppercase text-xs leading-4 tracking-wider px-1"
            style={{ color: "rgb(var(--text-secondary))" }}
          >
            {dateLabel}
          </p>
          <div className="flex mt-3 flex-col gap-2">
            {loading ? (
              <div className="py-4 text-center text-xs" style={{ color: "rgb(var(--text-secondary))" }}>
                Loading schedule...
              </div>
            ) : selectedDateEvents.length === 0 ? (
              <p className="text-xs px-1 italic" style={{ color: "rgb(var(--text-secondary))" }}>
                No meetings scheduled for this day.
              </p>
            ) : (
              selectedDateEvents.map((event) => {
                const EventIcon = getEventIcon(event.type);
                return (
                  <div
                    key={event.id}
                    className="rounded-lg border-l-2 p-3 transition-colors"
                    style={{
                      borderLeftColor: event.color,
                      background: "rgb(var(--bg-secondary))",
                    }}
                  >
                    <p className="font-medium text-sm leading-5" style={{ color: "rgb(var(--text-primary))" }}>
                      {event.summary}
                    </p>
                    <p className="text-[11px] leading-4 flex mt-1 items-center gap-1.5" style={{ color: "rgb(var(--text-secondary))" }}>
                      <Clock className="size-3" />
                      {event.timeRaw}
                    </p>
                    <p className="text-[11px] leading-4 flex mt-0.5 items-center gap-1.5" style={{ color: "rgb(var(--text-secondary))" }}>
                      <EventIcon className="size-3" />
                      {event.details}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* AI Agent Section */}
      <AiAgentPanel />
    </aside>
  );
}
