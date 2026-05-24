import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="text-center py-20">
      <div className="text-4xl mb-4">🎸</div>
      <h2 className="font-display font-bold text-xl italic mb-2">Page Not Found</h2>
      <Link href="/">
        <Button variant="outline" className="mt-4">Back to Songs</Button>
      </Link>
    </div>
  );
}
