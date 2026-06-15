"use client";

import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Key,
  Mail,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: {
    gmail: { clientId: string; clientSecret: string; connected: boolean; emailAddress: string };
    googlecalendar: { clientId: string; clientSecret: string; connected: boolean };
  };
  onSave: (data: {
    gmail: { clientId: string; clientSecret?: string };
    googlecalendar: { clientId: string; clientSecret?: string };
  }) => Promise<boolean>;
  onConnect: (plugin: "gmail" | "googlecalendar") => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
  onConnect,
}: SettingsModalProps) {
  const [tempGmail, setTempGmail] = useState({ clientId: "", clientSecret: "" });
  const [tempCalendar, setTempCalendar] = useState({ clientId: "", clientSecret: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    if (isOpen) {
      setTempGmail({ clientId: settings.gmail.clientId, clientSecret: "" });
      setTempCalendar({ clientId: settings.googlecalendar.clientId, clientSecret: "" });
      setSaveStatus("idle");
    }
  }, [isOpen, settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus("idle");
    try {
      const success = await onSave({
        gmail: {
          clientId: tempGmail.clientId,
          clientSecret: tempGmail.clientSecret || undefined,
        },
        googlecalendar: {
          clientId: tempCalendar.clientId,
          clientSecret: tempCalendar.clientSecret || undefined,
        },
      });
      setSaveStatus(success ? "success" : "error");
      if (success) {
        setTimeout(() => {
          onClose();
          setSaveStatus("idle");
        }, 1200);
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const CredentialSection = ({
    title,
    icon: Icon,
    iconColor,
    connected,
    plugin,
    temp,
    setTemp,
    hasExistingSecret,
  }: {
    title: string;
    icon: React.ElementType;
    iconColor: string;
    connected: boolean;
    plugin: "gmail" | "googlecalendar";
    temp: { clientId: string; clientSecret: string };
    setTemp: (v: { clientId: string; clientSecret: string }) => void;
    hasExistingSecret: boolean;
  }) => (
    <div className="space-y-3.5">
      <div
        className="flex items-center gap-2 pb-1.5 border-b"
        style={{ borderColor: "rgba(var(--border-secondary))" }}
      >
        <Icon className="size-4" style={{ color: iconColor }} />
        <span className="text-sm font-semibold" style={{ color: "rgb(var(--text-primary))" }}>
          {title}
        </span>
        {connected ? (
          <span
            className="ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
            style={{ color: "rgb(var(--accent-green))", background: "rgba(var(--accent-green), 0.1)" }}
          >
            <ShieldCheck className="size-3" /> Connected
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onConnect(plugin)}
            className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors"
            style={{ color: "rgb(var(--accent-orange))", background: "rgba(var(--accent-orange), 0.1)" }}
          >
            Connect
          </button>
        )}
      </div>
      <div className="grid gap-3">
        <div className="space-y-1">
          <label
            className="text-xs font-medium flex items-center gap-1"
            style={{ color: "rgb(var(--text-secondary))" }}
          >
            <Key className="size-3" /> Client ID
          </label>
          <input
            type="text"
            value={temp.clientId}
            onChange={(e) => setTemp({ ...temp, clientId: e.target.value })}
            placeholder="Enter Google Client ID"
            className="w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none focus:ring-1"
            style={{
              background: "rgb(var(--bg-secondary))",
              borderColor: "rgba(var(--border-primary))",
              color: "rgb(var(--text-primary))",
            }}
          />
        </div>
        <div className="space-y-1">
          <label
            className="text-xs font-medium flex items-center gap-1"
            style={{ color: "rgb(var(--text-secondary))" }}
          >
            <Key className="size-3" /> Client Secret
          </label>
          <input
            type="password"
            value={temp.clientSecret}
            onChange={(e) => setTemp({ ...temp, clientSecret: e.target.value })}
            placeholder={hasExistingSecret ? "•••••••• (Saved)" : "Enter Google Client Secret"}
            className="w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none focus:ring-1"
            style={{
              background: "rgb(var(--bg-secondary))",
              borderColor: "rgba(var(--border-primary))",
              color: "rgb(var(--text-primary))",
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 animate-fade-in" style={{ background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }} />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-xl p-6 animate-scale-in"
        style={{
          background: "rgb(var(--bg-elevated))",
          border: "1px solid rgba(var(--border-primary))",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 transition-colors"
          style={{ color: "rgb(var(--text-secondary))" }}
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-6">
          <div
            className="p-1.5 rounded-lg border"
            style={{
              background: "rgb(var(--bg-tertiary))",
              borderColor: "rgba(var(--border-secondary))",
            }}
          >
            <Settings className="size-5" style={{ color: "rgb(var(--text-primary))" }} />
          </div>
          <div>
            <h3 className="font-semibold text-base leading-5" style={{ color: "rgb(var(--text-primary))" }}>
              Integration Settings
            </h3>
            <p className="text-xs" style={{ color: "rgb(var(--text-secondary))" }}>
              Configure Google Cloud OAuth credentials
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <CredentialSection
            title="Gmail API Credentials"
            icon={Mail}
            iconColor="rgb(var(--accent-red))"
            connected={settings.gmail.connected}
            plugin="gmail"
            temp={tempGmail}
            setTemp={setTempGmail}
            hasExistingSecret={!!settings.gmail.clientId}
          />

          <CredentialSection
            title="Google Calendar Credentials"
            icon={Clock}
            iconColor="rgb(var(--accent-purple))"
            connected={settings.googlecalendar.connected}
            plugin="googlecalendar"
            temp={tempCalendar}
            setTemp={setTempCalendar}
            hasExistingSecret={!!settings.googlecalendar.clientId}
          />

          {/* Redirect URI Info */}
          <div
            className="rounded-lg border p-3 flex gap-2.5 text-xs leading-relaxed"
            style={{
              background: "rgb(var(--bg-secondary))",
              borderColor: "rgba(var(--border-secondary))",
              color: "rgb(var(--text-secondary))",
            }}
          >
            <AlertCircle className="size-4 shrink-0 mt-0.5" style={{ color: "rgb(var(--text-tertiary))" }} />
            <div>
              <span className="font-semibold" style={{ color: "rgb(var(--text-primary))" }}>
                Authorized Redirect URI:
              </span>{" "}
              Use{" "}
              <code
                className="mx-1 border px-1 py-0.5 rounded"
                style={{
                  background: "rgba(var(--bg-primary), 0.5)",
                  borderColor: "rgba(var(--border-secondary))",
                  color: "rgb(var(--text-primary))",
                }}
              >
                http://localhost:3000/api/auth/callback
              </code>{" "}
              in your Google Cloud Console Web Application settings.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {saveStatus === "success" && (
                <span className="flex items-center gap-1 text-xs" style={{ color: "rgb(var(--accent-green))" }}>
                  <CheckCircle className="size-4" /> Saved successfully!
                </span>
              )}
              {saveStatus === "error" && (
                <span className="flex items-center gap-1 text-xs" style={{ color: "rgb(var(--accent-red))" }}>
                  <AlertCircle className="size-4" /> Failed to save settings
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-lg text-xs font-semibold transition-colors"
                style={{
                  borderColor: "rgba(var(--border-primary))",
                  color: "rgb(var(--text-primary))",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                style={{
                  background: "rgb(var(--btn-primary-bg))",
                  color: "rgb(var(--btn-primary-text))",
                }}
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
