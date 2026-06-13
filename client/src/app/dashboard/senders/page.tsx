"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { deleteSender, getSenders } from "@/lib/apis";
import type { SenderResponse } from "@/types";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "../Sidebar";
import { TopBar } from "../Topbar";
import { SidebarProvider } from "@/context/SidebarContext";
import { useToast } from "@/context/ToastContext";
import { SenderModal } from "../compose/SenderModal";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import {
  AlertCircle,
  Inbox,
  Clock,
  Send,
  Plus,
  Pencil,
  Trash2,
  Mail,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export default function SendersPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [senders, setSenders] = useState<SenderResponse[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "verify" | "edit">("add");
  const [activeSender, setActiveSender] = useState<SenderResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SenderResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSenders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSenders();
      setSenders(data);
    } catch {
      setError("Failed to load senders. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSenders();
  }, [fetchSenders]);

  const filteredSenders = senders?.filter((sender) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      sender.email.toLowerCase().includes(q) ||
      (sender.name?.toLowerCase().includes(q) ?? false)
    );
  });

  const openAdd = () => {
    setActiveSender(null);
    setModalMode("add");
    setModalOpen(true);
  };

  const openEdit = (sender: SenderResponse) => {
    setActiveSender(sender);
    setModalMode(sender.isVerified ? "edit" : "verify");
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteSender(deleteTarget.id);
      addToast("success", `Sender removed: ${deleteTarget.email}`);
      setDeleteTarget(null);
      fetchSenders();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message ?? "Failed to delete sender.";
      addToast("error", msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AuthGuard>
      <SidebarProvider>
        <div className="flex h-screen bg-[#f8f9fb]">
          <Sidebar
            setLabel={() => {}}
            profile={{
              name: user?.name ?? "",
              email: user?.email ?? "",
              avatarUrl: user?.avatarUrl ?? "",
            }}
            items={[
              { label: "All", icon: <Inbox className="h-4 w-4" /> },
              { label: "Scheduled", icon: <Clock className="h-4 w-4" /> },
              { label: "Sent", icon: <Send className="h-4 w-4" /> },
            ]}
          />

          <main className="flex flex-1 flex-col min-w-0">
            <TopBar
              placeholder="Search senders..."
              initialValue={searchQuery}
              onSearch={setSearchQuery}
            />

            <div className="px-3 md:px-6 py-3 md:py-4 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Senders</h1>
                <p className="text-xs text-gray-400">
                  {filteredSenders
                    ? `${filteredSenders.length} sender${filteredSenders.length !== 1 ? "s" : ""}`
                    : "Loading..."}
                </p>
              </div>
              <Button className="w-auto px-4 py-2 rounded-lg text-xs gap-1.5" onClick={openAdd}>
                <Plus className="h-3.5 w-3.5" />
                Add Sender
              </Button>
            </div>

            {isLoading ? (
              <div className="flex-1 px-3 md:px-6 pb-4 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-white border border-gray-100 animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <AlertCircle className="h-8 w-8 text-red-300" />
                <p className="text-sm text-gray-500">{error}</p>
                <button onClick={fetchSenders} className="text-sm text-primary hover:underline">
                  Retry
                </button>
              </div>
            ) : !filteredSenders || filteredSenders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                  <Mail className="h-8 w-8 text-gray-300" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">No senders yet</h3>
                <p className="text-sm text-gray-400 max-w-xs mb-4">
                  Add a Fastmail or Gmail address to send campaigns from.
                </p>
                <Button className="w-auto px-5 py-2 rounded-lg text-xs" onClick={openAdd}>
                  Add Sender
                </Button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-3 md:px-6 pb-6 space-y-3">
                {filteredSenders.map((sender) => (
                  <div
                    key={sender.id}
                    className="rounded-xl bg-white border border-gray-100 p-4 md:p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {sender.name || sender.email}
                          </h3>
                          {sender.isVerified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                              <AlertTriangle className="h-3 w-3" />
                              Unverified
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{sender.email}</p>
                        <p className="text-[11px] text-gray-400 mt-2">
                          {sender.smtpHost?.includes("fastmail") ? "Fastmail" : "Gmail"} ·{" "}
                          {sender.currentDailyCount ?? 0} / {sender.dailyLimit} sent today
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(sender)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                          aria-label={`Edit ${sender.email}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(sender)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                          aria-label={`Delete ${sender.email}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>

        <SenderModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            fetchSenders();
          }}
          mode={modalMode}
          existingSender={modalMode === "add" ? null : activeSender}
        />

        {deleteTarget && (
          <Modal isOpen onClose={() => !isDeleting && setDeleteTarget(null)}>
            <div className="p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Delete sender?</h3>
              <p className="text-sm text-gray-500 mb-5">
                Remove <span className="font-medium text-gray-700">{deleteTarget.email}</span> from
                your account. This cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                  className="h-9 px-4 text-xs font-medium text-gray-500"
                >
                  Cancel
                </button>
                <Button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-auto px-4 py-2 rounded-lg text-xs bg-red-600 hover:bg-red-700"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </SidebarProvider>
    </AuthGuard>
  );
}
