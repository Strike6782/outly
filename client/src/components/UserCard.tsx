import Image from "next/image";

interface SidebarProfileProps {
  name: string;
  email: string;
  avatarUrl: string;
}

export function UserCard({ name, email, avatarUrl }: SidebarProfileProps) {
  return (
    <div className="flex items-center gap-3 px-1 py-1">
      <div className="shrink-0">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={name}
            className="h-10 w-10 rounded-lg object-cover"
            width={40}
            height={40}
          />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200 shadow-sm">
            <span className="text-sm font-bold text-gray-400">{name?.charAt(0)?.toUpperCase()}</span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 truncate tracking-tight">{name}</p>
        <p className="text-[11px] font-medium text-gray-400 truncate tracking-tight">{email}</p>
      </div>
    </div>
  );
}
