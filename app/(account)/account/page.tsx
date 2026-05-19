import { Eyebrow } from "@/components/brand/eyebrow";

export default function AccountHomePage() {
  return (
    <div>
      <Eyebrow>Account</Eyebrow>
      <h1
        className="serif text-[48px] font-normal mt-2"
        style={{ letterSpacing: "-0.025em" }}
      >
        Welcome back.
      </h1>
      <p className="mt-4 text-[15px] text-bz-muted max-w-[60ch]">
        Saved properties, saved searches, viewings, and your document vault
        will live here once Phase 1 ships.
      </p>
    </div>
  );
}
