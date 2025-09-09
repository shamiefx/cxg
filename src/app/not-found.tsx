import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="text-6xl font-bold">404</div>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-neutral-500">
        The page you&#39;re looking for doesn&#39;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 font-medium text-black hover:bg-yellow-400"
      >
        Go back home
      </Link>
    </main>
  );
}
