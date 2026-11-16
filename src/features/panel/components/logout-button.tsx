import { logout } from "@/features/auth/actions";

export function LogoutButton() {
  return (
    <form action={logout} className="text-center">
      <button
        type="submit"
        className="min-h-11 px-4 text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
      >
        Çıkış yap
      </button>
    </form>
  );
}
