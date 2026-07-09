import { Suspense } from "react";
import { MailosLanding } from "~/components/thread/mailos-landing";
import { ThreadAuthProvider } from "~/components/thread/thread-auth-provider";

export default function Home() {
  return (
    <Suspense>
      <ThreadAuthProvider>
        <MailosLanding />
      </ThreadAuthProvider>
    </Suspense>
  );
}
