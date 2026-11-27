import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import OnboardingForm from "@/components/OnboardingForm";

export const dynamic = "force-dynamic";

export default async function Onboarding() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.isVerified) redirect("/");
  return (
    <div className="max-w-md">
      <h1 className="mb-2 text-2xl font-bold">Verify your profile</h1>
      <p className="mb-4 text-sm text-gray-600">
        1) Click your avatar (top right), choose <b>Manage account</b> and add and verify a phone
        number by SMS code. 2) Enter your full legal name exactly as on your ID, then press the
        button. This name is bound to every ticket you buy.
      </p>
      <OnboardingForm initialName={user.fullName} />
    </div>
  );
}