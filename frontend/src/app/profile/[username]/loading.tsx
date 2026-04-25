import { AppShell } from "@/components/app-shell";
import { ProfileSkeleton } from "@/components/profile-skeleton";

export default function ProfileLoading() {
  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProfileSkeleton />
      </div>
    </AppShell>
  );
}
