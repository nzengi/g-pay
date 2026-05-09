import { AppHeader } from "../../components/AppHeader";
import { AppSidebar } from "../../components/AppSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex">
      <AppSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
