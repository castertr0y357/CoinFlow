import Link from "next/link";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-fade-in">
      <div className="glass p-12 rounded-3xl max-w-md w-full">
        <div className="text-6xl mb-6">🔍</div>
        <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
        <p className="text-dim mb-8">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/">
          <Button variant="primary">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
