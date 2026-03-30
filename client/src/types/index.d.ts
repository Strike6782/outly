// ─── Backend Response Types ───
// These match the exact shapes returned by the backend API endpoints.

// GET /users response — the authenticated user's profile
export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

// GET /senders response — sender account (appPassword excluded by backend)
export interface SenderResponse {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  isVerified: boolean;
  dailyLimit: number;
  currentDailyCount?: number;
  smtpHost: string;
  smtpPort: number;
  createdAt: string;
  updatedAt: string;
}

// POST /senders request body — payload for creating a new sender
export interface CreateSenderPayload {
  name: string;
  email: string;
  appPassword: string;
  skipWarmup?: boolean;
}

// POST /campaigns request body — payload for creating a new campaign
export interface CreateCampaignPayload {
  senderIds?: string[];
  senderId?: string;
  subject: string;
  body: string;
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
  emails: (string | { email: string; columnData?: Record<string, string> })[];
  attachments?: UploadedAttachment[];
  steps?: SequenceStepInput[];
  trackOpens?: boolean;
  trackClicks?: boolean;
}

// POST /attachments/upload response item — metadata for an uploaded file
export interface UploadedAttachment {
  url: string;        // Cloudinary secure_url
  filename: string;   // Original filename
  size: number;       // File size in bytes
  mimeType: string;   // MIME type (e.g., "application/pdf")
}

// GET /campaigns response item — campaign with nested sender info
export interface Campaign {
  id: string;
  subject: string;
  body: string;
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
  totalRecipients: number;
  status: "SCHEDULED" | "SENDING" | "PAUSED" | "CANCELLED" | "COMPLETED";
  pauseReason?: string | null;
  createdAt: string;
  sender: {
    id: string;
    email: string;
    name: string | null;
    isVerified: boolean;
  };
}

// Campaign detail with email jobs and status counts
export interface CampaignDetail extends Campaign {
  emails: (EmailJob & { sender?: { id: string; email: string; name: string | null } })[];
  senderPool: CampaignSenderType[];
  senderStats: SenderStat[];
  _count: {
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    cancelled: number;
  };
}

// EmailJob shape — matches the Prisma EmailJob model with SENDING status
export interface EmailJob {
  id: string;
  campaignId: string;
  toEmail: string;
  senderId: string | null;
  scheduledAt: string;
  sentAt: string | null;
  status: "PENDING" | "SENDING" | "SENT" | "FAILED" | "CANCELLED";
  error: string | null;
  isStarred: boolean | null;
  isReplied: boolean;
  sequenceStepId: string | null;
  createdAt: string;
}

// GET /users/emails response item — nested email + campaign data
export interface UserEmailItem {
  email: EmailJob;
  campaign: {
    subject: string;
    body: string;
  };
}

// ─── Component Prop Types ───

// ComposeFormData — internal form state for the compose page
// Note: attachments are managed separately via uploadedAttachments (UploadedAttachment[])
// in the parent ComposePage, not in this form data object.
export interface ComposeFormData {
  from: string;                  // Legacy: kept for backward compat
  selectedSenderIds: string[];   // New: multi-sender selection (sender IDs)
  to: string[];
  subject: string;
  body: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

// EmailRow component props — receives destructured email + campaign
export interface EmailRowProps {
  email?: EmailJob;
  campaign?: {
    subject?: string;
    body?: string;
  };
  onToggleStar?: (emailId: string) => void;
  searchQuery?: string;
}

// EmailList component props
export interface EmailListProps {
  emails?: EmailRowProps[];
  onToggleStar?: (emailId: string) => void;
}

// ComposeForm component props — receives lifted state from parent
// submitTrigger: counter incremented by the parent when the Header's Send button
// is clicked. The Form watches this in a useEffect to trigger validation + submission.
export interface ComposeFormProps {
  user: User | null;
  scheduledAt: Date | null;
  uploadedAttachments: UploadedAttachment[];
  onSubmit: (data: CreateCampaignPayload) => Promise<void>;
  submitTrigger?: number;
}

// ComposeHeader component props — lifted state + callbacks
export interface ComposeHeaderProps {
  onBack?: () => void;
  scheduledAt: Date | null;
  setScheduledAt: (date: Date | null) => void;
  uploadedAttachments: UploadedAttachment[];
  onFilesSelected: (files: File[]) => void;
  onRemoveAttachment: (url: string) => void;
  isUploading: boolean;
  onSend: () => void;
  isSubmitting: boolean;
}

// SenderModal component props
export interface SenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sender: SenderResponse) => void;
  // When set, the modal is in "verify" mode for an existing unverified sender
  existingSender?: SenderResponse | null;
}

// AuthGuard component props
export interface AuthGuardProps {
  children: React.ReactNode;
}

// Sidebar component props
export interface SidebarProps {
  currentLabel?: string;
  setLabel: React.Dispatch<React.SetStateAction<string>>;
  onItemClick?: (label: string) => void;
  profile: {
    name: string;
    email: string;
    avatarUrl: string;
  };
  items: {
    label: string;
    count?: number;
    icon?: React.ReactNode;
  }[];
}


// ─── Email Template Types ───

// GET /templates response item — email template
export interface EmailTemplate {
  id: string;
  userId: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

// POST /templates request body
export interface CreateTemplatePayload {
  name: string;
  subject: string;
  body: string;
}

// PUT /templates/:id request body
export interface UpdateTemplatePayload {
  name?: string;
  subject?: string;
  body?: string;
}

// Enhanced recipient type for campaign creation with variable data
export interface RecipientWithData {
  email: string;
  columnData: Record<string, string>;
}


// ─── Sequence Types ───

export interface SequenceStepType {
  id: string;
  campaignId: string;
  stepNumber: number;
  subject: string;
  body: string;
  waitDays: number;
}

export interface StepStatusType {
  stepNumber: number;
  status: "PENDING" | "SCHEDULED" | "SENT" | "FAILED" | "SKIPPED";
  sentAt: string | null;
  error: string | null;
  emailJobId: string | null;
}

export interface RecipientSequenceStateType {
  id: string;
  campaignId: string;
  recipientEmail: string;
  currentStep: number;
  paused: boolean;
  replied: boolean;
  completed: boolean;
  stepStatuses: StepStatusType[];
  createdAt: string;
  updatedAt: string;
}

export interface SequenceResponse {
  steps: SequenceStepType[];
  recipients: RecipientSequenceStateType[];
  hasSequence: boolean;
}

// Sequence step input for campaign creation
export interface SequenceStepInput {
  subject: string;
  body: string;
  waitDays: number;
}


// ─── Sender Rotation Types ───

// CampaignSenderType — a sender in a campaign's sender pool with rotation metadata
export interface CampaignSenderType {
  senderId: string;
  email: string;
  name: string | null;
  dailyLimit: number;
  rotationOrder: number;
}

// SenderStat — per-sender email count breakdown for campaign detail
export interface SenderStat {
  senderId: string;
  email: string;
  name: string | null;
  dailyLimit: number;
  sent: number;
  failed: number;
  pending: number;
}


// ─── Toast Notification Types ───

// Toast severity types
export type ToastType = "success" | "error" | "warning" | "info";

// Toast data structure
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
  createdAt: number;
  isPaused: boolean;
  remainingTime: number;
  isExiting: boolean;
}

// Hook return type
export interface UseToastReturn {
  addToast: (type: ToastType, message: string, options?: { duration?: number; title?: string }) => string;
  dismissToast: (id: string) => void;
}

// Reducer actions
export type ToastAction =
  | { type: "ADD_TOAST"; payload: Toast }
  | { type: "DISMISS_TOAST"; payload: { id: string } }
  | { type: "REMOVE_TOAST"; payload: { id: string } }
  | { type: "PAUSE_TOAST"; payload: { id: string } }
  | { type: "RESUME_TOAST"; payload: { id: string; remainingTime: number } }
  | { type: "START_EXIT"; payload: { id: string } };

// Toast queue state
export interface ToastState {
  toasts: Toast[];
}

// Default auto-dismiss durations per toast type (in milliseconds)
export type DefaultDurations = Record<ToastType, number>;

// Color scheme per toast type (Tailwind CSS classes)
export interface ToastColorScheme {
  bg: string;
  border: string;
  icon: string;
  text: string;
  progress: string;
}

export type ToastColors = Record<ToastType, ToastColorScheme>;


// ─── Email Tracking Types ───

export interface TrackingMetrics {
  campaignId: string;
  totalSent: number;
  uniqueOpens: number;
  uniqueClicks: number;
  openRate: number;
  clickRate: number;
  trackOpens: boolean;
  trackClicks: boolean;
}

export interface TrackingEmailDetail {
  emailJobId: string;
  toEmail: string;
  openCount: number;
  clickCount: number;
  lastOpenAt: string | null;
  lastClickAt: string | null;
}

export interface TrackingLinkDetail {
  url: string;
  clickCount: number;
}
