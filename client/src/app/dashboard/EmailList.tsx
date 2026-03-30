import { EmailRow } from "@/components/EmailRow";
import { EmailListProps } from "@/types";
import { Inbox } from "lucide-react";

export function EmailList({ emails, onToggleStar }: EmailListProps) {
  if (!emails || emails.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
          <Inbox className="h-8 w-8 text-gray-300" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">No emails yet</h3>
        <p className="text-sm text-gray-400 max-w-xs">
          Start a campaign to see your outreach emails appear here.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto scroll-touch"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {emails.map((email, idx) => (
        <EmailRow key={idx} {...email} onToggleStar={onToggleStar} />
      ))}
    </div>
  );
}
