//app/analysis/[id]/loading.tsx
export default function Loading() {
  return (
    <main className="container-content py-20 text-center">
      <div className="mx-auto inline-block h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-app-500" />
      <p className="mt-4 text-sm text-gray-600">Loading…</p>
    </main>
  );
}
