"use client";

import { User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface AccountMenuProps {
  email: string;
  role: string;
  onSignOut: () => void;
}

// Tách riêng để base-ui DropdownMenu + Avatar chỉ được tải khi thực sự có
// người dùng đăng nhập (khách vãng lai không cần).
export default function AccountMenu({ email, role, onSignOut }: AccountMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Mở menu tài khoản"
        className="cursor-pointer rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <Avatar className="h-9 w-9 ring-1 ring-gray-200">
          <AvatarFallback className="bg-gray-100 text-gray-700">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{email}</p>
          <p className="text-xs text-muted-foreground">
            {role === "seller" ? "Nhà bán" : "Người mua"}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>Đăng xuất</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
