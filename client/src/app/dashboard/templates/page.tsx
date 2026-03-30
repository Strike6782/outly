"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getTemplates, deleteTemplate as deleteTemplateApi } from "@/lib/apis";
import type { EmailTemplate } from "@/types";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "../Sidebar";
import { TopBar } from "../Topbar";
import { SidebarProvider } from "@/context/SidebarContext";
import { useToast } from "@/context/ToastContext";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import TemplateFormModal from "./TemplateFormModal";
import {
  AlertCircle,
  Inbox,
  Clock,
  Send,
  FileText,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

export default function TemplatesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("Templates");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch {
      setError("Failed to load templates. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormOpen(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setEditingTemplate(null);
    fetchTemplates();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteTemplateApi(deleteTarget.id);
      addToast("success", `Template deleted: ${deleteTarget.name}`);
      setDeleteTarget(null);
      fetchTemplates();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Failed to delete template.";
      setError(msg);
      addToast("error", `Failed to delete template: ${msg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));

  const stripHtml = (html: string) =>
    html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const filteredTemplates = templates?.filter((template) => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    return (
      template.name.toLowerCase().includes(lowerQuery) ||
      template.subject.toLowerCase().includes(lowerQuery)
    );
  });

  return (
    <AuthGuard>
      <SidebarProvider>
        <div className="flex h-screen bg-[#f8f9fb]">
          <Sidebar
            setLabel={setLabel}
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
              placeholder="Search templates..."
              initialValue={searchQuery}
              onSearch={setSearchQuery}
            />

            {/* Page header */}
            <div className="px-3 md:px-6 py-3 md:py-4 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Templates</h1>
                <p className="text-xs text-gray-400">
                  {filteredTemplates
                    ? `${filteredTemplates.length} template${filteredTemplates.length !== 1 ? "s" : ""}`
                    : "Loading..."}
                </p>
              </div>
              <Button
                className="w-auto px-4 py-2 rounded-lg text-xs gap-1.5"
                onClick={handleCreate}
              >
                <Plus className="h-3.5 w-3.5" />
                New Template
              </Button>
            </div>

            {isLoading ? (
              /* Skeleton loading state */
              <div className="flex-1 px-3 md:px-6 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-white border border-gray-100 p-5 animate-pulse"
                    >
                      <div className="h-4 w-2/3 bg-gray-100 rounded mb-3" />
                      <div className="h-3 w-full bg-gray-50 rounded mb-2" />
                      <div className="h-3 w-1/2 bg-gray-50 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <AlertCircle className="h-8 w-8 text-red-300" />
                <p className="text-sm text-gray-500">{error}</p>
                <button
                  onClick={fetchTemplates}
                  className="text-sm text-primary hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : !templates || templates.length === 0 ? (
              /* Empty state */
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-gray-300" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  No templates yet
                </h3>
                <p className="text-sm text-gray-400 max-w-xs mb-4">
                  Create your first template to speed up your outreach campaigns.
                </p>
                <Button
                  className="w-auto px-5 py-2 rounded-lg text-xs"
                  onClick={handleCreate}
                >
                  Create Template
                </Button>
              </div>
            ) : (filteredTemplates || []).length === 0 ? (
              /* No search results */
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-gray-300" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  No matching templates
                </h3>
                <p className="text-sm text-gray-400 max-w-xs mb-4">
                  Try adjusting your search query.
                </p>
              </div>
            ) : (
              /* Template card grid */
              <div className="flex-1 px-3 md:px-6 pb-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(filteredTemplates || []).map((template, index) => (
                    <div
                      key={template.id}
                      className="group rounded-xl bg-white border border-gray-100 p-5 shadow-sm
                        hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
                        opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-gray-900 truncate flex-1">
                          {template.name}
                        </h3>
                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                          <button
                            onClick={() => handleEdit(template)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary-light transition-colors"
                            aria-label={`Edit ${template.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(template)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            aria-label={`Delete ${template.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 truncate mb-3">
                        {template.subject || "No subject"}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate mb-3">
                        {stripHtml(template.body).slice(0, 80) || "No content"}
                      </p>
                      <p className="text-[11px] text-gray-300">
                        Updated {formatDate(template.updatedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Create/Edit modal */}
        {formOpen && (
          <TemplateFormModal
            template={editingTemplate}
            onClose={() => {
              setFormOpen(false);
              setEditingTemplate(null);
            }}
            onSuccess={handleFormSuccess}
          />
        )}

        {/* Delete confirmation modal */}
        {deleteTarget && (
          <Modal isOpen onClose={() => setDeleteTarget(null)}>
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Delete template?
              </h3>
              <p className="text-sm text-gray-500 mb-5">
                &ldquo;{deleteTarget.name}&rdquo; will be permanently removed. This
                won&apos;t affect any campaigns already sent.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1 rounded-lg"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  className="flex-1 rounded-lg"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
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
