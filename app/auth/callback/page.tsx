import { Suspense } from "react";
import AuthCallbackClient from "./AuthCallbackClient";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="p-4">Signing you in...</div>}>
      <AuthCallbackClient />
    </Suspense>
  );
}